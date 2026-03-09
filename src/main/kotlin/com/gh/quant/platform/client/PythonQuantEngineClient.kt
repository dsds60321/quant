package com.gh.quant.platform.client

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.gh.quant.platform.dto.MarketIndexDto
import com.gh.quant.platform.dto.NewsImpactGraphDto
import com.gh.quant.platform.exception.ExternalServiceException
import com.gh.quant.platform.exception.ResourceNotFoundException
import com.gh.quant.platform.exception.ValidationException
import java.io.IOException
import java.time.Duration
import java.util.concurrent.TimeoutException
import org.springframework.http.HttpStatusCode
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.WebClientRequestException
import org.slf4j.LoggerFactory
import reactor.core.publisher.Mono
import reactor.util.retry.Retry

@Component
class PythonQuantEngineClient(
    @Qualifier("pythonEngineWebClient")
    private val pythonEngineWebClient: WebClient,
    @Qualifier("pythonEngineLongRunningWebClient")
    private val pythonEngineLongRunningWebClient: WebClient,
    private val objectMapper: ObjectMapper,
) {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val requestRetrySpec: Retry = Retry.backoff(2, Duration.ofMillis(300))
        .maxBackoff(Duration.ofSeconds(2))
        .filter(::isTransientConnectionFailure)
    private val slowRequestThreshold: Duration = Duration.ofSeconds(5)

    private fun mapPythonError(prefix: String, statusCode: HttpStatusCode, body: String): Throwable {
        val message = "$prefix: $body"
        return when (statusCode.value()) {
            400, 422 -> ValidationException(message)
            404 -> ResourceNotFoundException(message)
            else -> ExternalServiceException(message)
        }
    }

    private fun isTransientConnectionFailure(error: Throwable): Boolean {
        val candidates = generateSequence(error) { it.cause }.toList()
        return candidates.any { candidate ->
            candidate is WebClientRequestException ||
                candidate is IOException ||
                candidate is TimeoutException ||
                candidate.message?.contains("Connection reset", ignoreCase = true) == true ||
                candidate.message?.contains("Broken pipe", ignoreCase = true) == true ||
                candidate.message?.contains("timed out", ignoreCase = true) == true
        }
    }

    private fun mapConnectionFailure(prefix: String, error: Throwable): Throwable {
        if (!isTransientConnectionFailure(error)) {
            return error
        }
        return ExternalServiceException("$prefix: 파이썬 엔진 연결이 일시적으로 끊어졌습니다. 잠시 후 다시 시도하세요.")
    }

    private fun logRequestSuccess(method: String, uri: String, startedAtNanos: Long) {
        val elapsed = Duration.ofNanos(System.nanoTime() - startedAtNanos)
        if (elapsed >= slowRequestThreshold) {
            logger.info("python engine {} {} completed in {} ms", method, uri, elapsed.toMillis())
        }
    }

    private fun logRequestFailure(method: String, uri: String, startedAtNanos: Long, error: Throwable) {
        val elapsed = Duration.ofNanos(System.nanoTime() - startedAtNanos)
        logger.warn(
            "python engine {} {} failed after {} ms: {}",
            method,
            uri,
            elapsed.toMillis(),
            error.javaClass.simpleName,
        )
    }

    private fun getDataNode(uri: String): JsonNode {
        val startedAtNanos = System.nanoTime()
        return try {
            val response = pythonEngineWebClient.get()
                .uri(uri)
                .retrieve()
                .onStatus(HttpStatusCode::isError) { response ->
                    response.bodyToMono(String::class.java)
                        .flatMap { Mono.error(mapPythonError("파이썬 엔진 GET 실패($uri)", response.statusCode(), it)) }
                }
                .bodyToMono(JsonNode::class.java)
                .retryWhen(requestRetrySpec)
                .onErrorMap { error -> mapConnectionFailure("파이썬 엔진 GET 실패($uri)", error) }
                .block()
            logRequestSuccess("GET", uri, startedAtNanos)
            response?.get("data") ?: objectMapper.nodeFactory.nullNode()
        } catch (error: Throwable) {
            logRequestFailure("GET", uri, startedAtNanos, error)
            throw error
        }
    }

    private fun getDataNode(
        uriLabel: String,
        uriBuilder: (org.springframework.web.util.UriBuilder) -> java.net.URI,
    ): JsonNode {
        val startedAtNanos = System.nanoTime()
        return try {
            val response = pythonEngineWebClient.get()
                .uri(uriBuilder)
                .retrieve()
                .onStatus(HttpStatusCode::isError) { response ->
                    response.bodyToMono(String::class.java)
                        .flatMap { Mono.error(mapPythonError("파이썬 엔진 GET 실패($uriLabel)", response.statusCode(), it)) }
                }
                .bodyToMono(JsonNode::class.java)
                .retryWhen(requestRetrySpec)
                .onErrorMap { error -> mapConnectionFailure("파이썬 엔진 GET 실패($uriLabel)", error) }
                .block()
            logRequestSuccess("GET", uriLabel, startedAtNanos)
            response?.get("data") ?: objectMapper.nodeFactory.nullNode()
        } catch (error: Throwable) {
            logRequestFailure("GET", uriLabel, startedAtNanos, error)
            throw error
        }
    }

    private fun getDataNodeBestEffort(
        uriLabel: String,
        uriBuilder: (org.springframework.web.util.UriBuilder) -> java.net.URI,
        timeout: Duration,
    ): JsonNode {
        val startedAtNanos = System.nanoTime()
        return try {
            val response = pythonEngineWebClient.get()
                .uri(uriBuilder)
                .retrieve()
                .onStatus(HttpStatusCode::isError) { response ->
                    response.bodyToMono(String::class.java)
                        .flatMap { Mono.error(mapPythonError("파이썬 엔진 GET 실패($uriLabel)", response.statusCode(), it)) }
                }
                .bodyToMono(JsonNode::class.java)
                .timeout(timeout)
                .onErrorMap { error -> mapConnectionFailure("파이썬 엔진 GET 실패($uriLabel)", error) }
                .block()
            logRequestSuccess("GET", uriLabel, startedAtNanos)
            response?.get("data") ?: objectMapper.nodeFactory.nullNode()
        } catch (error: Throwable) {
            logRequestFailure("GET", uriLabel, startedAtNanos, error)
            throw error
        }
    }

    private fun postDataNode(uri: String, body: Any? = null, webClient: WebClient = pythonEngineWebClient): JsonNode {
        val startedAtNanos = System.nanoTime()
        val request = webClient.post().uri(uri)
        val responseSpec = if (body != null) request.bodyValue(body).retrieve() else request.retrieve()
        return try {
            val response = responseSpec
                .onStatus(HttpStatusCode::isError) { response ->
                    response.bodyToMono(String::class.java)
                        .flatMap { Mono.error(mapPythonError("파이썬 엔진 POST 실패($uri)", response.statusCode(), it)) }
                }
                .bodyToMono(JsonNode::class.java)
                .onErrorMap { error -> mapConnectionFailure("파이썬 엔진 POST 실패($uri)", error) }
                .block()
            logRequestSuccess("POST", uri, startedAtNanos)
            response?.get("data") ?: objectMapper.nodeFactory.nullNode()
        } catch (error: Throwable) {
            logRequestFailure("POST", uri, startedAtNanos, error)
            throw error
        }
    }

    fun getMarketIndices(): List<MarketIndexDto> = objectMapper.convertValue(
        getDataNode("/market/indices"),
        object : TypeReference<List<MarketIndexDto>>() {},
    )

    fun generateCandidates(request: Map<String, Any>): Map<String, Any> = objectMapper.convertValue(
        postDataNode("/strategy/candidates", request, pythonEngineLongRunningWebClient),
        object : TypeReference<Map<String, Any>>() {},
    )

    fun runBacktest(request: Map<String, Any>): Map<String, Any> = objectMapper.convertValue(
        postDataNode("/backtest", request),
        object : TypeReference<Map<String, Any>>() {},
    )

    fun optimize(request: Map<String, Any>): Map<String, Any> = objectMapper.convertValue(
        postDataNode("/optimize", request),
        object : TypeReference<Map<String, Any>>() {},
    )

    fun compare(request: Map<String, Any>): Map<String, Any> = objectMapper.convertValue(
        postDataNode("/strategy/compare", request),
        object : TypeReference<Map<String, Any>>() {},
    )

    fun triggerDataUpdate(request: Map<String, Any>? = null): Map<String, Any> = objectMapper.convertValue(
        postDataNode("/data/update", request),
        object : TypeReference<Map<String, Any>>() {},
    )

    fun getDataStatus(): Map<String, Any> = objectMapper.convertValue(
        getDataNode("/data/status"),
        object : TypeReference<Map<String, Any>>() {},
    )

    fun getRisk(portfolioId: Long): Map<String, Any> = objectMapper.convertValue(
        getDataNode("/risk") { builder -> builder.path("/risk").queryParam("portfolioId", portfolioId).build() },
        object : TypeReference<Map<String, Any>>() {},
    )

    fun searchStockSymbols(query: String, marketType: String?, assetGroup: String?, limit: Int): List<Map<String, Any>> = objectMapper.convertValue(
        getDataNode("/stocks/search") { builder ->
            val baseBuilder = builder.path("/stocks/search")
                .queryParam("q", query)
                .queryParam("limit", limit)
            val marketBuilder = if (!marketType.isNullOrBlank()) baseBuilder.queryParam("marketType", marketType) else baseBuilder
            if (!assetGroup.isNullOrBlank()) marketBuilder.queryParam("assetGroup", assetGroup).build() else marketBuilder.build()
        },
        object : TypeReference<List<Map<String, Any>>>() {},
    )

    fun getNewsImpactGraph(symbol: String): NewsImpactGraphDto = objectMapper.convertValue(
        getDataNode("/news/impact/$symbol"),
        NewsImpactGraphDto::class.java,
    )

    fun syncNewsForSymbol(symbol: String, limit: Int = 20): Map<String, Any> = objectMapper.convertValue(
        getDataNode("/news/sentiment") { builder ->
            builder.path("/news/sentiment")
                .queryParam("symbol", symbol)
                .queryParam("limit", limit)
                .build()
        },
        object : TypeReference<Map<String, Any>>() {},
    )

    fun syncNewsForSymbolBestEffort(symbol: String, limit: Int = 20, timeout: Duration = Duration.ofSeconds(3)) {
        runCatching {
            getDataNodeBestEffort(
                uriLabel = "/news/sentiment",
                uriBuilder = { builder ->
                    builder.path("/news/sentiment")
                        .queryParam("symbol", symbol)
                        .queryParam("limit", limit)
                        .build()
                },
                timeout = timeout,
            )
        }
    }

    fun registerStockSymbol(request: Map<String, Any>): Map<String, Any> = objectMapper.convertValue(
        postDataNode("/stocks/register", request),
        object : TypeReference<Map<String, Any>>() {},
    )
}
