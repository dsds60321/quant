package com.gh.quant.platform.service

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.gh.quant.platform.client.PythonQuantEngineClient
import com.gh.quant.platform.domain.entity.Job
import com.gh.quant.platform.dto.FactorCandidateDto
import com.gh.quant.platform.dto.StrategyCandidateDiagnosticsDto
import com.gh.quant.platform.repository.JobRepository
import java.math.BigDecimal
import java.time.OffsetDateTime
import java.util.concurrent.Executors
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager

internal fun emptyStrategyCandidateDiagnostics(): StrategyCandidateDiagnosticsDto = StrategyCandidateDiagnosticsDto(
    totalSymbols = 0,
    priceReadyCount = 0,
    fundamentalsReadyCount = 0,
    roePassCount = 0,
    pbrPassCount = 0,
    momentumPassCount = 0,
    finalSelectedCount = 0,
)

internal fun mapStrategyCandidateAnalysis(payload: Map<String, Any>): Pair<List<FactorCandidateDto>, StrategyCandidateDiagnosticsDto> {
    val candidates = (payload["candidates"] as? List<*>)?.mapNotNull { item ->
        val value = item as? Map<*, *> ?: return@mapNotNull null
        FactorCandidateDto(
            symbol = value["symbol"]?.toString() ?: "N/A",
            score = BigDecimal(value["score"]?.toString() ?: "0"),
        )
    } ?: emptyList()

    val diagnosticsMap = payload["diagnostics"] as? Map<*, *> ?: emptyMap<String, Any>()
    val diagnostics = StrategyCandidateDiagnosticsDto(
        totalSymbols = (diagnosticsMap["totalSymbols"] as? Number)?.toInt()
            ?: (diagnosticsMap["total_symbols"] as? Number)?.toInt()
            ?: 0,
        priceReadyCount = (diagnosticsMap["priceReadyCount"] as? Number)?.toInt()
            ?: (diagnosticsMap["price_ready_count"] as? Number)?.toInt()
            ?: 0,
        fundamentalsReadyCount = (diagnosticsMap["fundamentalsReadyCount"] as? Number)?.toInt()
            ?: (diagnosticsMap["fundamentals_ready_count"] as? Number)?.toInt()
            ?: 0,
        roePassCount = (diagnosticsMap["roePassCount"] as? Number)?.toInt()
            ?: (diagnosticsMap["roe_pass_count"] as? Number)?.toInt()
            ?: 0,
        pbrPassCount = (diagnosticsMap["pbrPassCount"] as? Number)?.toInt()
            ?: (diagnosticsMap["pbr_pass_count"] as? Number)?.toInt()
            ?: 0,
        momentumPassCount = (diagnosticsMap["momentumPassCount"] as? Number)?.toInt()
            ?: (diagnosticsMap["momentum_pass_count"] as? Number)?.toInt()
            ?: 0,
        finalSelectedCount = (diagnosticsMap["finalSelectedCount"] as? Number)?.toInt()
            ?: (diagnosticsMap["final_selected_count"] as? Number)?.toInt()
            ?: candidates.size,
    )
    return candidates to diagnostics
}

internal fun parseStrategyAnalysisMetadata(
    objectMapper: ObjectMapper,
    metadataJson: String?,
): Map<String, Any?> {
    if (metadataJson.isNullOrBlank()) {
        return emptyMap()
    }
    return try {
        objectMapper.readValue(metadataJson, object : TypeReference<Map<String, Any?>>() {})
    } catch (_: Exception) {
        emptyMap()
    }
}

@Component
class StrategyAnalysisDispatcher(
    private val jobRepository: JobRepository,
    private val pythonQuantEngineClient: PythonQuantEngineClient,
    private val objectMapper: ObjectMapper,
) {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val executor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "strategy-analysis").apply { isDaemon = true }
    }

    fun enqueueAfterCommit(
        strategyId: Long,
        strategyUpdatedAt: OffsetDateTime?,
        payload: Map<String, Any>,
    ): Long {
        val job = jobRepository.save(
            Job(
                jobType = "strategy_candidate_analysis",
                status = "PENDING",
                message = "전략 저장 완료. 후보 종목 분석 대기 중입니다.",
                metadataJson = writeMetadata(
                    strategyId = strategyId,
                    strategyUpdatedAt = strategyUpdatedAt,
                    stage = "queued",
                    stageLabel = "대기 중",
                    progressPercent = 0,
                ),
            ),
        )
        val jobId = job.id ?: error("전략 분석 작업 ID를 생성하지 못했습니다.")
        val submitAction = {
            executor.submit {
                runJob(
                    jobId = jobId,
                    strategyId = strategyId,
                    strategyUpdatedAt = strategyUpdatedAt,
                    payload = payload,
                )
            }
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                object : TransactionSynchronization {
                    override fun afterCommit() {
                        submitAction()
                    }
                },
            )
        } else {
            submitAction()
        }
        return jobId
    }

    private fun runJob(
        jobId: Long,
        strategyId: Long,
        strategyUpdatedAt: OffsetDateTime?,
        payload: Map<String, Any>,
    ) {
        try {
            val runningJob = jobRepository.findById(jobId).orElse(null)
            if (runningJob != null) {
                runningJob.status = "RUNNING"
                runningJob.startedAt = OffsetDateTime.now()
                runningJob.message = "후보 종목 분석을 실행 중입니다."
                runningJob.metadataJson = writeMetadata(
                    strategyId = strategyId,
                    strategyUpdatedAt = strategyUpdatedAt,
                    stage = "analyzing",
                    stageLabel = "후보 분석",
                    progressPercent = 15,
                )
                jobRepository.save(runningJob)
            }

            val analysis = mapStrategyCandidateAnalysis(pythonQuantEngineClient.generateCandidates(payload))
            val completedJob = jobRepository.findById(jobId).orElse(null)
            if (completedJob != null) {
                completedJob.status = "COMPLETED"
                completedJob.finishedAt = OffsetDateTime.now()
                completedJob.message = "후보 종목 ${analysis.first.size}개 분석 완료"
                completedJob.metadataJson = writeMetadata(
                    strategyId = strategyId,
                    strategyUpdatedAt = strategyUpdatedAt,
                    stage = "completed",
                    stageLabel = "완료",
                    progressPercent = 100,
                    candidates = analysis.first,
                    diagnostics = analysis.second,
                )
                jobRepository.save(completedJob)
            }
        } catch (exc: Exception) {
            logger.warn("strategy candidate analysis failed strategyId={}", strategyId, exc)
            val failedJob = jobRepository.findById(jobId).orElse(null)
            if (failedJob != null) {
                failedJob.status = "FAILED"
                failedJob.finishedAt = OffsetDateTime.now()
                failedJob.message = exc.message ?: "후보 종목 분석 중 오류가 발생했습니다."
                failedJob.metadataJson = writeMetadata(
                    strategyId = strategyId,
                    strategyUpdatedAt = strategyUpdatedAt,
                    stage = "failed",
                    stageLabel = "실패",
                    progressPercent = 100,
                    error = exc.message ?: exc.javaClass.simpleName,
                )
                jobRepository.save(failedJob)
            }
        }
    }

    private fun writeMetadata(
        strategyId: Long,
        strategyUpdatedAt: OffsetDateTime?,
        stage: String,
        stageLabel: String,
        progressPercent: Int,
        candidates: List<FactorCandidateDto> = emptyList(),
        diagnostics: StrategyCandidateDiagnosticsDto = emptyStrategyCandidateDiagnostics(),
        error: String? = null,
    ): String = objectMapper.writeValueAsString(
        linkedMapOf(
            "kind" to "strategyAnalysis",
            "strategyId" to strategyId,
            "strategyUpdatedAt" to strategyUpdatedAt?.toString(),
            "progressPercent" to progressPercent,
            "stage" to stage,
            "stageLabel" to stageLabel,
            "candidates" to candidates.map { candidate ->
                mapOf(
                    "symbol" to candidate.symbol,
                    "score" to candidate.score,
                )
            },
            "diagnostics" to mapOf(
                "totalSymbols" to diagnostics.totalSymbols,
                "priceReadyCount" to diagnostics.priceReadyCount,
                "fundamentalsReadyCount" to diagnostics.fundamentalsReadyCount,
                "roePassCount" to diagnostics.roePassCount,
                "pbrPassCount" to diagnostics.pbrPassCount,
                "momentumPassCount" to diagnostics.momentumPassCount,
                "finalSelectedCount" to diagnostics.finalSelectedCount,
            ),
            "error" to error,
        ),
    )
}
