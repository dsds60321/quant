package com.gh.quant.platform.config

import io.netty.channel.ChannelOption
import io.netty.handler.timeout.ReadTimeoutHandler
import io.netty.handler.timeout.WriteTimeoutHandler
import java.time.Duration
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.client.reactive.ReactorClientHttpConnector
import org.springframework.web.reactive.function.client.WebClient
import reactor.netty.http.client.HttpClient

@Configuration
class WebClientConfig {
    @Bean
    @Qualifier("pythonEngineWebClient")
    fun pythonEngineWebClient(@Value("\${platform.python-engine.base-url}") baseUrl: String): WebClient =
        buildPythonEngineWebClient(baseUrl, Duration.ofSeconds(120))

    @Bean
    @Qualifier("pythonEngineLongRunningWebClient")
    fun pythonEngineLongRunningWebClient(@Value("\${platform.python-engine.base-url}") baseUrl: String): WebClient =
        buildPythonEngineWebClient(baseUrl, Duration.ofMinutes(10))

    private fun buildPythonEngineWebClient(baseUrl: String, responseTimeout: Duration): WebClient {
        val timeoutSeconds = responseTimeout.seconds.coerceAtLeast(1).toInt()
        val httpClient = HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5_000)
            .responseTimeout(responseTimeout)
            .doOnConnected { connection ->
                connection.addHandlerLast(ReadTimeoutHandler(timeoutSeconds))
                connection.addHandlerLast(WriteTimeoutHandler(timeoutSeconds))
            }

        return WebClient.builder()
            .baseUrl(baseUrl)
            .clientConnector(ReactorClientHttpConnector(httpClient))
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .build()
    }
}
