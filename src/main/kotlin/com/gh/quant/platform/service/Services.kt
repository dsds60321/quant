package com.gh.quant.platform.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.gh.quant.platform.client.PythonQuantEngineClient
import com.gh.quant.platform.domain.entity.Backtest
import com.gh.quant.platform.domain.entity.BacktestEquity
import com.gh.quant.platform.domain.entity.Job
import com.gh.quant.platform.domain.entity.Portfolio
import com.gh.quant.platform.domain.entity.Position
import com.gh.quant.platform.domain.entity.Strategy
import com.gh.quant.platform.domain.entity.StrategyFactor
import com.gh.quant.platform.domain.entity.StrategyComparisonRun
import com.gh.quant.platform.domain.entity.StrategyOptimizationRun
import com.gh.quant.platform.domain.entity.StrategyRun
import com.gh.quant.platform.domain.entity.StrategyWeightSnapshot
import com.gh.quant.platform.domain.entity.TradingOrder
import com.gh.quant.platform.dto.BacktestHistoryItemDto
import com.gh.quant.platform.dto.BacktestJobStatusDto
import com.gh.quant.platform.dto.BacktestQueueResponseDto
import com.gh.quant.platform.dto.BacktestRequest
import com.gh.quant.platform.dto.BacktestResultDto
import com.gh.quant.platform.dto.BacktestSnapshotDto
import com.gh.quant.platform.dto.DashboardSummaryDto
import com.gh.quant.platform.dto.DataSourceStatusDto
import com.gh.quant.platform.dto.DataStatusDto
import com.gh.quant.platform.dto.DataUpdateRequest
import com.gh.quant.platform.dto.ActiveDataJobDto
import com.gh.quant.platform.dto.FactorCandidateDto
import com.gh.quant.platform.dto.JobDto
import com.gh.quant.platform.dto.MarketIndexDto
import com.gh.quant.platform.dto.MarketSectorDto
import com.gh.quant.platform.dto.NewsIntelligenceDto
import com.gh.quant.platform.dto.NewsImpactGraphDto
import com.gh.quant.platform.dto.OrderCreateRequest
import com.gh.quant.platform.dto.OrderDto
import com.gh.quant.platform.dto.PortfolioAssetCreateRequest
import com.gh.quant.platform.dto.AssetDeleteResponseDto
import com.gh.quant.platform.dto.AssetRegistrationResponseDto
import com.gh.quant.platform.dto.DeleteResponseDto
import com.gh.quant.platform.dto.ManagedPositionDto
import com.gh.quant.platform.dto.PortfolioCreateRequest
import com.gh.quant.platform.dto.PortfolioCreateResponseDto
import com.gh.quant.platform.dto.PortfolioDetailDto
import com.gh.quant.platform.dto.PortfolioListItemDto
import com.gh.quant.platform.dto.PortfolioSummaryDto
import com.gh.quant.platform.dto.PositionDto
import com.gh.quant.platform.dto.RiskSummaryDto
import com.gh.quant.platform.dto.ScreenerStockDto
import com.gh.quant.platform.dto.SeriesPointDto
import com.gh.quant.platform.dto.StockLookupDto
import com.gh.quant.platform.dto.StockRegisterRequest
import com.gh.quant.platform.dto.StrategyUpdateRequest
import com.gh.quant.platform.dto.StrategyCompareRequest
import com.gh.quant.platform.dto.StrategyComparisonHistoryDto
import com.gh.quant.platform.dto.StrategyCandidateDiagnosticsDto
import com.gh.quant.platform.dto.StrategyOptimizationHistoryDto
import com.gh.quant.platform.dto.StrategyRunDto
import com.gh.quant.platform.dto.StrategyCreateRequest
import com.gh.quant.platform.dto.StrategyCreateResponse
import com.gh.quant.platform.dto.StrategyDiagnosticsDto
import com.gh.quant.platform.dto.StrategyFactorWeightRequest
import com.gh.quant.platform.dto.StrategySummaryDto
import com.gh.quant.platform.dto.StrategyRunRequest
import com.gh.quant.platform.dto.StrategyWeightSnapshotCreateRequest
import com.gh.quant.platform.dto.StrategyWeightSnapshotDto
import com.gh.quant.platform.dto.OptimizationRequest
import com.gh.quant.platform.dto.ImpactStockDto
import com.gh.quant.platform.dto.EventAnalysisDto
import com.gh.quant.platform.dto.EventReactionDto
import com.gh.quant.platform.dto.AlternativeDataCenterDto
import com.gh.quant.platform.dto.AlternativeDatasetDto
import com.gh.quant.platform.exception.ResourceNotFoundException
import com.gh.quant.platform.exception.ValidationException
import com.gh.quant.platform.repository.BacktestRepository
import com.gh.quant.platform.repository.BacktestEquityRepository
import com.gh.quant.platform.repository.JobRepository
import com.gh.quant.platform.repository.NewsRepository
import com.gh.quant.platform.repository.NewsSymbolRepository
import com.gh.quant.platform.repository.EventRepository
import com.gh.quant.platform.repository.PortfolioHistoryRepository
import com.gh.quant.platform.repository.PortfolioRepository
import com.gh.quant.platform.repository.PositionRepository
import com.gh.quant.platform.repository.StockRepository
import com.gh.quant.platform.repository.StrategyFactorRepository
import com.gh.quant.platform.repository.StrategyRepository
import com.gh.quant.platform.repository.StrategyWeightSnapshotRepository
import com.gh.quant.platform.repository.StrategyOptimizationRunRepository
import com.gh.quant.platform.repository.StrategyComparisonRunRepository
import com.gh.quant.platform.repository.StrategyRunRepository
import com.gh.quant.platform.repository.TradingOrderRepository
import com.gh.quant.platform.repository.UserRepository
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.OffsetDateTime
import java.time.LocalDate
import java.time.ZoneOffset
import org.springframework.cache.annotation.CacheEvict
import org.springframework.cache.annotation.Cacheable
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class DashboardService(
    private val positionRepository: PositionRepository,
    private val portfolioHistoryRepository: PortfolioHistoryRepository,
    private val backtestRepository: BacktestRepository,
    private val strategyRunRepository: StrategyRunRepository,
) {
    fun getDashboardSummary(portfolioId: Long): DashboardSummaryDto {
        val portfolioValue = positionRepository.findByPortfolioId(portfolioId)
            .mapNotNull { it.marketValue }
            .fold(BigDecimal.ZERO, BigDecimal::add)

        val history = portfolioHistoryRepository.findTop2ByPortfolioIdOrderByDateDesc(portfolioId)
        val dailyReturn = if (history.size >= 2 && history[1].portfolioValue != null && history[1].portfolioValue!! > BigDecimal.ZERO) {
            history[0].portfolioValue!!
                .subtract(history[1].portfolioValue)
                .divide(history[1].portfolioValue, 6, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
        } else {
            BigDecimal.ZERO
        }
        val latestBacktest = backtestRepository.findTopByOrderByCreatedAtDesc()
        return DashboardSummaryDto(
            portfolioValue = portfolioValue,
            dailyReturn = dailyReturn,
            sharpe = latestBacktest?.sharpe ?: BigDecimal.ZERO,
            alpha = BigDecimal("3.12"),
            maxDrawdown = latestBacktest?.maxDrawdown ?: BigDecimal.ZERO,
            activeStrategies = strategyRunRepository.countByStatus("RUNNING"),
        )
    }
}

@Service
class MarketService(
    private val pythonQuantEngineClient: PythonQuantEngineClient,
    private val jdbcTemplate: JdbcTemplate,
) {
    fun getIndices(): List<MarketIndexDto> = pythonQuantEngineClient.getMarketIndices()

    fun getSectors(): List<MarketSectorDto> {
        val sql = """
            with latest_dates as (
                select
                    max(date) as latest_date,
                    (
                        select max(date)
                        from prices
                        where date < (select max(date) from prices)
                    ) as previous_date
            )
            select
                coalesce(nullif(trim(s.sector), ''), '미분류') as sector,
                avg(
                    case
                        when p_prev.close is null or p_prev.close = 0 then 0
                        else ((p_latest.close - p_prev.close) / p_prev.close) * 100
                    end
                ) as change_percent,
                count(*) as stock_count
            from stocks s
            join latest_dates d on d.latest_date is not null and d.previous_date is not null
            join prices p_latest on p_latest.symbol = s.symbol and p_latest.date = d.latest_date
            join prices p_prev on p_prev.symbol = s.symbol and p_prev.date = d.previous_date
            group by coalesce(nullif(trim(s.sector), ''), '미분류')
            order by abs(avg(
                case
                    when p_prev.close is null or p_prev.close = 0 then 0
                    else ((p_latest.close - p_prev.close) / p_prev.close) * 100
                end
            )) desc, count(*) desc
            limit 8
        """.trimIndent()

        return jdbcTemplate.query(sql) { rs, _ ->
            MarketSectorDto(
                sector = rs.getString("sector"),
                changePercent = rs.getBigDecimal("change_percent") ?: BigDecimal.ZERO,
                stockCount = rs.getInt("stock_count"),
            )
        }
    }
}

@Service
class StrategyService(
    private val strategyRepository: StrategyRepository,
    private val strategyFactorRepository: StrategyFactorRepository,
    private val strategyWeightSnapshotRepository: StrategyWeightSnapshotRepository,
    private val backtestRepository: BacktestRepository,
    private val portfolioRepository: PortfolioRepository,
    private val strategyRunRepository: StrategyRunRepository,
    private val strategyOptimizationRunRepository: StrategyOptimizationRunRepository,
    private val strategyComparisonRunRepository: StrategyComparisonRunRepository,
    private val pythonQuantEngineClient: PythonQuantEngineClient,
    private val strategyAnalysisDispatcher: StrategyAnalysisDispatcher,
    private val jobRepository: JobRepository,
    private val objectMapper: ObjectMapper,
) {
    @Transactional
    fun createStrategy(request: StrategyCreateRequest): StrategyCreateResponse {
        val normalizedFactors = normalizeFactorWeights(request.factorWeightMode, request.factorWeights)
        val strategy = strategyRepository.save(
            Strategy(
                name = request.name.trim(),
                description = buildStrategyDescription(request),
                roeFilter = request.roe,
                pbrFilter = request.pbr,
                momentumFilter = request.momentum,
                stockCount = request.stockCount,
                rebalancePeriod = request.rebalance,
                weightingMethod = "EQUAL_WEIGHT",
                factorWeightMode = request.factorWeightMode.uppercase(),
                status = "DRAFT",
            ),
        )
        saveStrategyFactors(strategy, normalizedFactors)
        val analysisJobId = strategyAnalysisDispatcher.enqueueAfterCommit(
            strategyId = strategy.id!!,
            strategyUpdatedAt = strategy.updatedAt,
            payload = buildCandidatePayload(request),
        )
        return queuedStrategyResponse(strategy.id!!, analysisJobId)
    }

    @Transactional
    fun updateStrategy(strategyId: Long, request: StrategyUpdateRequest): StrategyCreateResponse {
        val normalizedFactors = normalizeFactorWeights(request.factorWeightMode, request.factorWeights)
        val strategy = strategyRepository.findById(strategyId).orElseThrow { ResourceNotFoundException("전략을 찾을 수 없습니다.") }
        if (strategy.status == "DELETED") {
            throw ValidationException("삭제된 전략은 수정할 수 없습니다.")
        }
        strategy.name = request.name.trim()
        strategy.description = buildStrategyDescription(request.stockCount, request.rebalance)
        strategy.roeFilter = request.roe
        strategy.pbrFilter = request.pbr
        strategy.momentumFilter = request.momentum
        strategy.stockCount = request.stockCount
        strategy.rebalancePeriod = request.rebalance
        strategy.factorWeightMode = request.factorWeightMode.uppercase()
        strategyRepository.save(strategy)
        saveStrategyFactors(strategy, normalizedFactors)
        val analysisJobId = strategyAnalysisDispatcher.enqueueAfterCommit(
            strategyId = strategy.id!!,
            strategyUpdatedAt = strategy.updatedAt,
            payload = buildCandidatePayload(request),
        )
        return queuedStrategyResponse(strategy.id!!, analysisJobId)
    }

    @Transactional
    fun deleteStrategy(strategyId: Long): DeleteResponseDto {
        val strategy = strategyRepository.findById(strategyId).orElseThrow { ResourceNotFoundException("전략을 찾을 수 없습니다.") }
        strategy.status = "DELETED"
        strategyRepository.save(strategy)
        return DeleteResponseDto(id = strategyId, deleted = true)
    }

    @Transactional(readOnly = true)
    fun getStrategies(): List<StrategySummaryDto> {
        val strategies = strategyRepository.findByStatusNotOrderByCreatedAtDesc("DELETED")
        if (strategies.isEmpty()) {
            return emptyList()
        }

        val latestBacktests = backtestRepository.findByStrategyIdIn(strategies.mapNotNull { it.id })
            .groupBy { it.strategy?.id }
            .mapValues { (_, backtests) -> backtests.maxByOrNull { it.createdAt ?: OffsetDateTime.MIN } }
        val factorWeightsByStrategy = strategyFactorRepository.findByStrategyIdIn(strategies.mapNotNull { it.id })
            .groupBy { it.strategy?.id }

        return strategies.mapNotNull { strategy ->
            val strategyId = strategy.id ?: return@mapNotNull null
            val factorWeights = factorWeightsByStrategy[strategyId]
                ?.associate { factor ->
                    factor.factorName to ((factor.factorWeight ?: BigDecimal.ZERO).multiply(BigDecimal("100")).setScale(1, RoundingMode.HALF_UP))
                }
                ?: emptyMap()
            StrategySummaryDto(
                strategyId = strategyId,
                name = strategy.name,
                description = strategy.description,
                roe = strategy.roeFilter,
                pbr = strategy.pbrFilter,
                momentum = strategy.momentumFilter,
                stockCount = strategy.stockCount,
                rebalance = strategy.rebalancePeriod,
                weightingMethod = strategy.weightingMethod,
                factorWeightMode = strategy.factorWeightMode,
                factorWeights = factorWeights,
                status = strategy.status,
                createdAt = strategy.createdAt ?: OffsetDateTime.now(),
                latestBacktest = latestBacktests[strategyId]?.toBacktestSnapshot(),
            )
        }
    }

    @Transactional(readOnly = true)
    fun getStrategyDiagnostics(strategyId: Long): StrategyDiagnosticsDto {
        val strategy = strategyRepository.findById(strategyId).orElseThrow { ResourceNotFoundException("전략을 찾을 수 없습니다.") }
        if (strategy.status == "DELETED") {
            throw ValidationException("삭제된 전략은 진단할 수 없습니다.")
        }
        val latestAnalysisJob = findLatestStrategyAnalysisJob(strategyId, strategy.updatedAt)
        if (latestAnalysisJob == null) {
            return StrategyDiagnosticsDto(
                strategyId = strategyId,
                candidates = emptyList(),
                diagnostics = emptyStrategyCandidateDiagnostics(),
                analysisStatus = "STALE",
                analysisMessage = "후보 종목 분석 이력이 없습니다. 전략을 다시 저장하면 백그라운드 분석을 시작합니다.",
            )
        }
        val analysisSourceJob = if (latestAnalysisJob.status == "COMPLETED") {
            latestAnalysisJob
        } else {
            findLatestCompletedStrategyAnalysisJob(strategyId, strategy.updatedAt)
        }
        val analysis = if (analysisSourceJob != null) {
            val metadata = parseStrategyAnalysisMetadata(objectMapper, analysisSourceJob.metadataJson)
            @Suppress("UNCHECKED_CAST")
            mapStrategyCandidateAnalysis(metadata as Map<String, Any>)
        } else {
            emptyList<FactorCandidateDto>() to emptyStrategyCandidateDiagnostics()
        }
        return StrategyDiagnosticsDto(
            strategyId = strategyId,
            candidates = analysis.first,
            diagnostics = analysis.second,
            analysisJobId = latestAnalysisJob.id,
            analysisStatus = latestAnalysisJob.status,
            analysisMessage = latestAnalysisJob.message,
        )
    }

    @Transactional
    fun createWeightSnapshot(request: StrategyWeightSnapshotCreateRequest): StrategyWeightSnapshotDto {
        val strategy = strategyRepository.findById(request.strategyId).orElseThrow { ResourceNotFoundException("전략을 찾을 수 없습니다.") }
        val normalizedFactors = normalizeFactorWeights(request.factorWeightMode, request.factorWeights)
        val snapshot = strategyWeightSnapshotRepository.save(
            StrategyWeightSnapshot(
                strategy = strategy,
                name = request.name.trim(),
                factorWeightMode = request.factorWeightMode.uppercase(),
                factorWeightsJson = objectMapper.writeValueAsString(
                    normalizedFactors.mapValues { (_, value) -> value.multiply(BigDecimal("100")).setScale(1, RoundingMode.HALF_UP) },
                ),
            ),
        )
        return snapshot.toDto()
    }

    @Transactional(readOnly = true)
    fun getWeightSnapshots(strategyId: Long): List<StrategyWeightSnapshotDto> {
        strategyRepository.findById(strategyId).orElseThrow { ResourceNotFoundException("전략을 찾을 수 없습니다.") }
        return strategyWeightSnapshotRepository.findByStrategyIdOrderByCreatedAtDesc(strategyId).map { it.toDto() }
    }

    @Transactional
    fun startStrategy(request: StrategyRunRequest): StrategyRun {
        val strategy = strategyRepository.findById(request.strategyId).orElseThrow { ResourceNotFoundException("전략을 찾을 수 없습니다.") }
        val portfolio = portfolioRepository.findById(request.portfolioId).orElseThrow { ResourceNotFoundException("포트폴리오를 찾을 수 없습니다.") }
        return strategyRunRepository.save(StrategyRun(strategy = strategy, portfolio = portfolio, status = "RUNNING", startedAt = OffsetDateTime.now()))
    }

    @Transactional
    fun stopStrategy(strategyRunId: Long): StrategyRun {
        val run = strategyRunRepository.findById(strategyRunId).orElseThrow { ResourceNotFoundException("전략 실행 이력을 찾을 수 없습니다.") }
        run.status = "STOPPED"
        run.finishedAt = OffsetDateTime.now()
        return strategyRunRepository.save(run)
    }

    @Transactional
    fun optimize(request: OptimizationRequest): Map<String, Any> {
        strategyRepository.findById(request.strategyId).orElseThrow { ResourceNotFoundException("전략을 찾을 수 없습니다.") }
        val payload = mapOf(
                "strategyId" to request.strategyId,
                "parameter" to request.parameter,
                "start" to request.start,
                "end" to request.end,
                "step" to request.step,
                "objective" to request.objective,
                "startDate" to request.startDate?.toString(),
                "endDate" to request.endDate?.toString(),
                "benchmarkSymbol" to request.benchmarkSymbol,
            )
            .filterValues { it != null }
            .mapValues { (_, value) -> value as Any }
        val result = pythonQuantEngineClient.optimize(payload)
        val trials = result["trials"] as? List<*> ?: emptyList<Any>()
        if (trials.isEmpty()) {
            throw ValidationException("최적화 결과가 없습니다. 가격 데이터와 전략 조건을 확인하세요.")
        }
        val optimizationRun = strategyOptimizationRunRepository.save(
            StrategyOptimizationRun(
                strategy = strategyRepository.findById(request.strategyId).orElseThrow { ResourceNotFoundException("전략을 찾을 수 없습니다.") },
                parameterName = request.parameter,
                startValue = request.start,
                endValue = request.end,
                stepValue = request.step,
                objective = request.objective,
                benchmarkSymbol = request.benchmarkSymbol,
                startDate = request.startDate,
                endDate = request.endDate,
                status = "COMPLETED",
                bestParametersJson = objectMapper.writeValueAsString(result["bestParameters"] ?: emptyMap<String, Any>()),
                resultJson = objectMapper.writeValueAsString(result),
            ),
        )
        jobRepository.save(
            Job(
                jobType = "strategy_optimization",
                status = "COMPLETED",
                startedAt = OffsetDateTime.now(),
                finishedAt = OffsetDateTime.now(),
                message = "전략 ${request.strategyId} 최적화 완료",
                metadataJson = objectMapper.writeValueAsString(mapOf("optimizationRunId" to optimizationRun.id, "strategyId" to request.strategyId)),
            ),
        )
        return result
    }

    @Transactional
    fun compare(request: StrategyCompareRequest): Map<String, Any> {
        request.strategyIds.forEach { strategyId ->
            strategyRepository.findById(strategyId).orElseThrow { ResourceNotFoundException("전략을 찾을 수 없습니다.") }
        }
        val payload = mapOf(
                "strategyIds" to request.strategyIds,
                "startDate" to request.startDate?.toString(),
                "endDate" to request.endDate?.toString(),
                "benchmarkSymbol" to request.benchmarkSymbol,
            )
            .filterValues { it != null }
            .mapValues { (_, value) -> value as Any }
        val result = pythonQuantEngineClient.compare(payload)
        val strategies = result["strategies"] as? List<*> ?: emptyList<Any>()
        if (strategies.isEmpty()) {
            throw ValidationException("전략 비교 결과가 없습니다. 가격 데이터와 비교 전략을 확인하세요.")
        }
        val comparisonRun = strategyComparisonRunRepository.save(
            StrategyComparisonRun(
                benchmarkSymbol = request.benchmarkSymbol,
                strategyIdsJson = objectMapper.writeValueAsString(request.strategyIds),
                startDate = request.startDate,
                endDate = request.endDate,
                status = "COMPLETED",
                resultJson = objectMapper.writeValueAsString(result),
            ),
        )
        jobRepository.save(
            Job(
                jobType = "strategy_comparison",
                status = "COMPLETED",
                startedAt = OffsetDateTime.now(),
                finishedAt = OffsetDateTime.now(),
                message = "전략 ${request.strategyIds.joinToString(",")} 비교 완료",
                metadataJson = objectMapper.writeValueAsString(mapOf("comparisonRunId" to comparisonRun.id, "strategyIds" to request.strategyIds)),
            ),
        )
        return result
    }

    fun getStrategyRuns(): List<StrategyRunDto> = strategyRunRepository.findTop20ByOrderByCreatedAtDesc()
        .mapNotNull { run ->
            val id = run.id ?: return@mapNotNull null
            val strategyId = run.strategy?.id ?: return@mapNotNull null
            val strategyName = run.strategy?.name ?: "전략-${strategyId}"
            val portfolioId = run.portfolio?.id ?: return@mapNotNull null
            StrategyRunDto(id, strategyId, strategyName, portfolioId, run.status, run.startedAt, run.finishedAt)
        }

    @Transactional(readOnly = true)
    fun getOptimizationHistory(): List<StrategyOptimizationHistoryDto> = strategyOptimizationRunRepository.findTop20ByOrderByCreatedAtDesc()
        .mapNotNull { run ->
            val id = run.id ?: return@mapNotNull null
            val strategy = run.strategy ?: return@mapNotNull null
            val strategyId = strategy.id ?: return@mapNotNull null
            StrategyOptimizationHistoryDto(
                id = id,
                strategyId = strategyId,
                strategyName = strategy.name,
                parameterName = run.parameterName,
                objective = run.objective,
                benchmarkSymbol = run.benchmarkSymbol,
                status = run.status,
                startDate = run.startDate?.toString(),
                endDate = run.endDate?.toString(),
                createdAt = run.createdAt ?: OffsetDateTime.now(),
                bestParametersJson = run.bestParametersJson,
                resultJson = run.resultJson,
            )
        }

    @Transactional(readOnly = true)
    fun getComparisonHistory(): List<StrategyComparisonHistoryDto> = strategyComparisonRunRepository.findTop20ByOrderByCreatedAtDesc()
        .mapNotNull { run ->
            val id = run.id ?: return@mapNotNull null
            StrategyComparisonHistoryDto(
                id = id,
                benchmarkSymbol = run.benchmarkSymbol,
                strategyIdsJson = run.strategyIdsJson,
                status = run.status,
                startDate = run.startDate?.toString(),
                endDate = run.endDate?.toString(),
                createdAt = run.createdAt ?: OffsetDateTime.now(),
                resultJson = run.resultJson,
            )
        }

    private fun buildCandidatePayload(request: StrategyCreateRequest): Map<String, Any> = mapOf(
        "roe" to request.roe,
        "pbr" to request.pbr,
        "momentum" to request.momentum,
        "stockCount" to request.stockCount,
        "rebalance" to request.rebalance,
        "factorWeightMode" to request.factorWeightMode,
        "factorWeights" to request.factorWeights.map { mapOf("factorName" to it.factorName, "factorWeight" to it.factorWeight) },
    )

    private fun buildCandidatePayload(request: StrategyUpdateRequest): Map<String, Any> = mapOf(
        "roe" to request.roe,
        "pbr" to request.pbr,
        "momentum" to request.momentum,
        "stockCount" to request.stockCount,
        "rebalance" to request.rebalance,
        "factorWeightMode" to request.factorWeightMode,
        "factorWeights" to request.factorWeights.map { mapOf("factorName" to it.factorName, "factorWeight" to it.factorWeight) },
    )

    private fun queuedStrategyResponse(strategyId: Long, analysisJobId: Long): StrategyCreateResponse = StrategyCreateResponse(
        strategyId = strategyId,
        candidates = emptyList(),
        diagnostics = emptyStrategyCandidateDiagnostics(),
        analysisJobId = analysisJobId,
        analysisStatus = "QUEUED",
        analysisMessage = "전략 저장은 완료되었고 후보 종목 분석은 백그라운드에서 진행됩니다.",
    )

    private fun findLatestStrategyAnalysisJob(strategyId: Long, strategyUpdatedAt: OffsetDateTime?): Job? {
        val expectedUpdatedAt = strategyUpdatedAt?.toString()
        return jobRepository.findTop200ByJobTypeOrderByCreatedAtDesc("strategy_candidate_analysis")
            .firstOrNull { job ->
                val metadata = parseStrategyAnalysisMetadata(objectMapper, job.metadataJson)
                val metadataStrategyId = (metadata["strategyId"] as? Number)?.toLong()
                val metadataUpdatedAt = metadata["strategyUpdatedAt"]?.toString()
                metadataStrategyId == strategyId && metadataUpdatedAt == expectedUpdatedAt
            }
    }

    private fun findLatestCompletedStrategyAnalysisJob(strategyId: Long, strategyUpdatedAt: OffsetDateTime?): Job? {
        val expectedUpdatedAt = strategyUpdatedAt?.toString()
        return jobRepository.findTop200ByJobTypeOrderByCreatedAtDesc("strategy_candidate_analysis")
            .firstOrNull { job ->
                if (job.status != "COMPLETED") {
                    return@firstOrNull false
                }
                val metadata = parseStrategyAnalysisMetadata(objectMapper, job.metadataJson)
                val metadataStrategyId = (metadata["strategyId"] as? Number)?.toLong()
                val metadataUpdatedAt = metadata["strategyUpdatedAt"]?.toString()
                metadataStrategyId == strategyId && metadataUpdatedAt == expectedUpdatedAt
            }
    }

    private fun saveStrategyFactors(strategy: Strategy, weights: Map<String, BigDecimal>) {
        val strategyId = strategy.id ?: throw ValidationException("전략 식별자가 없어 팩터 가중치를 저장할 수 없습니다.")
        val existing = strategyFactorRepository.findByStrategyId(strategyId)
        if (existing.isNotEmpty()) {
            strategyFactorRepository.deleteAll(existing)
        }
        if (weights.isEmpty()) {
            return
        }
        strategyFactorRepository.saveAll(
            weights.map { (factorName, factorWeight) ->
                StrategyFactor(
                    strategy = strategy,
                    factorName = factorName,
                    factorWeight = factorWeight,
                )
            },
        )
    }

    private fun normalizeFactorWeights(mode: String, weights: List<StrategyFactorWeightRequest>): Map<String, BigDecimal> {
        val defaultWeights = linkedMapOf(
            "momentum" to BigDecimal("0.35"),
            "value" to BigDecimal("0.25"),
            "quality" to BigDecimal("0.20"),
            "news" to BigDecimal("0.05"),
            "earnings_surprise" to BigDecimal("0.10"),
            "insider_activity" to BigDecimal("0.05"),
        )
        if (mode.uppercase() == "AUTO") {
            return defaultWeights
        }
        val sanitized = weights
            .filter { it.factorName.lowercase() in defaultWeights.keys }
            .associate { it.factorName.lowercase() to it.factorWeight.max(BigDecimal.ZERO) }
            .toMutableMap()
        for (factorName in defaultWeights.keys) {
            sanitized.putIfAbsent(factorName, BigDecimal.ZERO)
        }
        val total = sanitized.values.fold(BigDecimal.ZERO, BigDecimal::add)
        if (total <= BigDecimal.ZERO) {
            throw ValidationException("수동 가중치는 최소 1개 이상 0보다 커야 합니다.")
        }
        return sanitized.mapValues { (_, value) ->
            value.divide(total, 6, RoundingMode.HALF_UP)
        }
    }

    private fun StrategyWeightSnapshot.toDto(): StrategyWeightSnapshotDto {
        val strategyId = strategy?.id ?: throw ResourceNotFoundException("스냅샷 전략 ID를 찾을 수 없습니다.")
        val weights = parseFactorWeightsJson(factorWeightsJson)
            .mapValues { (_, value) -> BigDecimal(value.toString()) }
        return StrategyWeightSnapshotDto(
            snapshotId = id ?: throw ResourceNotFoundException("스냅샷 ID를 찾을 수 없습니다."),
            strategyId = strategyId,
            name = name,
            factorWeightMode = factorWeightMode,
            factorWeights = weights,
            createdAt = createdAt ?: OffsetDateTime.now(),
        )
    }

    private fun parseFactorWeightsJson(value: String): Map<String, Any> {
        return try {
            objectMapper.readValue(value, object : com.fasterxml.jackson.core.type.TypeReference<Map<String, Any>>() {})
        } catch (_: Exception) {
            emptyMap()
        }
    }

    private fun buildStrategyDescription(stockCount: Int, rebalance: String): String =
        "종목 ${stockCount}개 · ${rebalance} 리밸런싱 · 동일가중"

    private fun buildStrategyDescription(request: StrategyCreateRequest): String = buildStrategyDescription(request.stockCount, request.rebalance)

    private fun Backtest.toBacktestSnapshot(): BacktestSnapshotDto {
        val backtestId = id ?: throw ResourceNotFoundException("백테스트 식별자를 찾을 수 없습니다.")
        return BacktestSnapshotDto(
            backtestId = backtestId,
            snapshotId = snapshot?.id,
            snapshotName = snapshot?.name,
            startDate = startDate,
            endDate = endDate,
            cagr = cagr,
            sharpe = sharpe,
            maxDrawdown = maxDrawdown,
            winRate = winRate,
            createdAt = createdAt ?: OffsetDateTime.now(),
        )
    }
}

@Service
class BacktestService(
    private val strategyRepository: StrategyRepository,
    private val strategyWeightSnapshotRepository: StrategyWeightSnapshotRepository,
    private val backtestRepository: BacktestRepository,
    private val backtestEquityRepository: BacktestEquityRepository,
    private val pythonQuantEngineClient: PythonQuantEngineClient,
    private val jobRepository: JobRepository,
    private val objectMapper: ObjectMapper,
) {
    @Transactional
    fun runBacktest(request: BacktestRequest): BacktestQueueResponseDto {
        if (request.startDate.isAfter(request.endDate)) {
            throw ValidationException("백테스트 시작일은 종료일보다 늦을 수 없습니다.")
        }
        val strategy = strategyRepository.findById(request.strategyId).orElseThrow { ResourceNotFoundException("전략을 찾을 수 없습니다.") }
        if (strategy.status == "DELETED") {
            throw ValidationException("삭제된 전략은 백테스트할 수 없습니다.")
        }
        val snapshot = request.snapshotId?.let {
            strategyWeightSnapshotRepository.findById(it).orElseThrow { ResourceNotFoundException("가중치 스냅샷을 찾을 수 없습니다.") }
        }
        val snapshotWeights = snapshot?.factorWeightsJson?.let(::parseMetadata)?.map { (key, value) ->
            mapOf("factorName" to key, "factorWeight" to BigDecimal(value.toString()))
        } ?: emptyList()
        val payload = mutableMapOf<String, Any>(
            "strategyId" to request.strategyId,
            "startDate" to request.startDate.toString(),
            "endDate" to request.endDate.toString(),
            "factorWeightMode" to (snapshot?.factorWeightMode ?: "AUTO"),
            "factorWeights" to snapshotWeights,
        )
        request.snapshotId?.let { payload["snapshotId"] = it }
        val result = pythonQuantEngineClient.runBacktest(payload)
        return BacktestQueueResponseDto(
            accepted = result["accepted"] as? Boolean ?: false,
            jobId = (result["jobId"] as? Number)?.toLong(),
            status = result["status"]?.toString() ?: "QUEUED",
            message = result["message"]?.toString() ?: "백테스트 작업이 등록되었습니다.",
        )
    }

    @Transactional(readOnly = true)
    fun getBacktestJobStatus(jobId: Long): BacktestJobStatusDto {
        val job = jobRepository.findById(jobId).orElseThrow { ResourceNotFoundException("백테스트 작업을 찾을 수 없습니다.") }
        val metadata = parseMetadata(job.metadataJson)
        return BacktestJobStatusDto(
            jobId = jobId,
            status = job.status,
            message = job.message,
            backtestId = (metadata["backtestId"] as? Number)?.toLong(),
            rebalanceCount = (metadata["rebalanceCount"] as? Number)?.toInt(),
            averageSelectionCount = (metadata["averageSelectionCount"] as? Number)?.toDouble(),
            latestSelectionCount = (metadata["latestSelectionCount"] as? Number)?.toInt(),
            startedAt = job.startedAt,
            finishedAt = job.finishedAt,
        )
    }

    @Transactional(readOnly = true)
    fun getBacktestHistory(strategyId: Long?): List<BacktestHistoryItemDto> {
        val backtests = if (strategyId != null) {
            backtestRepository.findTop20ByStrategyIdOrderByCreatedAtDesc(strategyId)
        } else {
            backtestRepository.findTop20ByOrderByCreatedAtDesc()
        }
        return backtests.mapNotNull { backtest ->
            val backtestId = backtest.id ?: return@mapNotNull null
            val strategy = backtest.strategy ?: return@mapNotNull null
            val resolvedStrategyId = strategy.id ?: return@mapNotNull null
            BacktestHistoryItemDto(
                backtestId = backtestId,
                strategyId = resolvedStrategyId,
                strategyName = strategy.name,
                snapshotId = backtest.snapshot?.id,
                snapshotName = backtest.snapshot?.name,
                startDate = backtest.startDate?.toString(),
                endDate = backtest.endDate?.toString(),
                cagr = backtest.cagr,
                sharpe = backtest.sharpe,
                maxDrawdown = backtest.maxDrawdown,
                winRate = backtest.winRate,
                createdAt = backtest.createdAt ?: OffsetDateTime.now(),
            )
        }
    }

    @Transactional(readOnly = true)
    fun getBacktestDetail(backtestId: Long): BacktestResultDto {
        val backtest = backtestRepository.findById(backtestId).orElseThrow { ResourceNotFoundException("백테스트를 찾을 수 없습니다.") }
        val equityCurve = backtestEquityRepository.findByBacktestIdOrderByDateAsc(backtestId)
            .mapNotNull { point ->
                val date = point.date ?: return@mapNotNull null
                val value = point.equityValue ?: return@mapNotNull null
                SeriesPointDto(date = date.toString(), value = value)
            }
        if (equityCurve.isEmpty()) {
            throw ValidationException("백테스트 곡선 데이터가 없습니다.")
        }
        return BacktestResultDto(
            backtestId = backtestId,
            cagr = backtest.cagr,
            sharpe = backtest.sharpe,
            maxDrawdown = backtest.maxDrawdown,
            winRate = backtest.winRate,
            equityCurve = equityCurve,
            drawdownCurve = calculateDrawdownCurve(equityCurve),
            monthlyReturns = calculateMonthlyReturns(equityCurve),
        )
    }

    private fun calculateDrawdownCurve(equityCurve: List<SeriesPointDto>): List<SeriesPointDto> {
        var runningPeak = BigDecimal.ZERO
        return equityCurve.map { point ->
            if (point.value > runningPeak) {
                runningPeak = point.value
            }
            val drawdown = if (runningPeak <= BigDecimal.ZERO) {
                BigDecimal.ZERO
            } else {
                point.value.subtract(runningPeak)
                    .divide(runningPeak, 6, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
            }
            SeriesPointDto(date = point.date, value = drawdown)
        }
    }

    private fun calculateMonthlyReturns(equityCurve: List<SeriesPointDto>): List<SeriesPointDto> {
        val monthlyPoints = equityCurve
            .groupBy { it.date.substring(0, 7) }
            .mapNotNull { (month, points) ->
                val first = points.firstOrNull()?.value ?: return@mapNotNull null
                val last = points.lastOrNull()?.value ?: return@mapNotNull null
                val value = if (first <= BigDecimal.ZERO) {
                    BigDecimal.ZERO
                } else {
                    last.subtract(first)
                        .divide(first, 6, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                }
                SeriesPointDto(date = "${month}-01", value = value)
            }

        return monthlyPoints.sortedBy { it.date }
    }

    private fun parseMetadata(metadataJson: String?): Map<String, Any?> {
        if (metadataJson.isNullOrBlank()) {
            return emptyMap()
        }
        return try {
            @Suppress("UNCHECKED_CAST")
            objectMapper.readValue(metadataJson, Map::class.java) as Map<String, Any?>
        } catch (_: Exception) {
            emptyMap()
        }
    }
}

@Service
class ScreenerService(private val stockRepository: StockRepository) {
    fun search(perLt: BigDecimal?, roeGt: BigDecimal?, pbrLt: BigDecimal?): List<ScreenerStockDto> =
        stockRepository.searchByFactors(perLt, roeGt, pbrLt)
}

@Service
class StockLookupService(
    private val stockRepository: StockRepository,
    private val pythonQuantEngineClient: PythonQuantEngineClient,
) {
    @Cacheable(value = ["stockLookup"], unless = "#result == null || #result.isEmpty()")
    fun search(query: String, marketType: String?, assetGroup: String?, limit: Int = 20): List<StockLookupDto> {
        val resolvedLimit = limit.coerceIn(1, 20)
        val dbResults = stockRepository.searchStocks(query = query, marketType = marketType, assetGroup = assetGroup, limit = resolvedLimit)
        val externalResults = runCatching {
            pythonQuantEngineClient.searchStockSymbols(query, marketType, assetGroup, resolvedLimit)
        }.getOrElse { emptyList() }

        val merged = LinkedHashMap<String, StockLookupDto>()
        dbResults.forEach { item ->
            merged[item.symbol] = item
        }
        externalResults.forEach { item ->
            val symbol = item["symbol"]?.toString()?.trim()?.uppercase().orEmpty()
            if (symbol.isBlank() || merged.containsKey(symbol)) {
                return@forEach
            }
            merged[symbol] = StockLookupDto(
                symbol = symbol,
                name = item["name"]?.toString() ?: symbol,
                exchange = item["exchange"]?.toString() ?: "UNKNOWN",
                marketType = item["marketType"]?.toString() ?: "INTERNATIONAL",
                assetGroup = item["assetGroup"]?.toString() ?: "STOCK",
                currency = item["currency"]?.toString() ?: "USD",
                marketCap = (item["marketCap"] as? Number)?.toString()?.let(::BigDecimal),
            )
        }

        return merged.values.take(resolvedLimit)
    }

    @CacheEvict(value = ["stockLookup"], allEntries = true)
    fun registerSymbol(request: StockRegisterRequest): StockLookupDto {
        val payload = mapOf(
            "symbol" to request.symbol.trim(),
            "marketType" to request.marketType,
            "assetGroup" to request.assetGroup,
            "period" to request.period,
            "interval" to request.interval,
        ).filterValues { !it.isNullOrBlank() }
            .mapValues { (_, value) -> value as Any }

        val result = pythonQuantEngineClient.registerStockSymbol(payload)
        return StockLookupDto(
            symbol = result["symbol"]?.toString() ?: request.symbol.trim().uppercase(),
            name = result["name"]?.toString() ?: request.symbol.trim().uppercase(),
            exchange = result["exchange"]?.toString() ?: "UNKNOWN",
            marketType = result["marketType"]?.toString() ?: "INTERNATIONAL",
            assetGroup = result["assetGroup"]?.toString() ?: "STOCK",
            currency = result["currency"]?.toString() ?: "USD",
            marketCap = (result["marketCap"] as? Number)?.toString()?.let(::BigDecimal),
        )
    }
}

@Service
class PortfolioService(
    private val userRepository: UserRepository,
    private val portfolioRepository: PortfolioRepository,
    private val positionRepository: PositionRepository,
    private val portfolioHistoryRepository: PortfolioHistoryRepository,
    private val stockRepository: StockRepository,
) {
    @Transactional(readOnly = true)
    fun listPortfolios(): List<PortfolioListItemDto> {
        val portfolios = portfolioRepository.findAllByOrderByCreatedAtDesc()
        if (portfolios.isEmpty()) {
            return emptyList()
        }

        val portfolioIds = portfolios.mapNotNull { it.id }
        val positionsByPortfolio = positionRepository.findByPortfolioIdIn(portfolioIds).groupBy { it.portfolio?.id }

        return portfolios.mapNotNull { portfolio ->
            val portfolioId = portfolio.id ?: return@mapNotNull null
            val positions = positionsByPortfolio[portfolioId].orEmpty()
            val portfolioValue = calculatePortfolioValue(positions)
            val pnl = calculatePnL(positions)
            PortfolioListItemDto(
                portfolioId = portfolioId,
                name = portfolio.name,
                baseCurrency = portfolio.baseCurrency,
                status = portfolio.status,
                portfolioValue = portfolioValue,
                pnl = pnl,
                dailyReturn = calculateDailyReturn(portfolioId),
                positionCount = positions.size,
            )
        }
    }

    @Transactional
    fun createPortfolio(request: PortfolioCreateRequest): PortfolioCreateResponseDto {
        val owner = resolveDefaultUser()
        val saved = portfolioRepository.save(
            Portfolio(
                user = owner,
                name = request.name.trim(),
                baseCurrency = request.baseCurrency.trim().uppercase(),
                status = "ACTIVE",
            ),
        )
        return PortfolioCreateResponseDto(saved.id!!)
    }

    @Transactional
    fun registerAsset(request: PortfolioAssetCreateRequest): AssetRegistrationResponseDto {
        val portfolio = portfolioRepository.findById(request.portfolioId).orElseThrow { ResourceNotFoundException("포트폴리오를 찾을 수 없습니다.") }
        val symbol = request.symbol.trim().uppercase()
        stockRepository.findBySymbol(symbol) ?: throw ValidationException("종목 마스터에 없는 심볼입니다. 종목 검색에서 선택하거나 먼저 등록하세요.")
        val existing = positionRepository.findByPortfolioIdAndSymbol(request.portfolioId, symbol)

        val position = if (existing != null) {
            val mergedQuantity = (existing.quantity ?: BigDecimal.ZERO).add(request.quantity)
            val previousCost = (existing.avgPrice ?: BigDecimal.ZERO).multiply(existing.quantity ?: BigDecimal.ZERO)
            val incomingCost = request.avgPrice.multiply(request.quantity)
            val mergedAvgPrice = if (mergedQuantity > BigDecimal.ZERO) {
                previousCost.add(incomingCost).divide(mergedQuantity, 6, RoundingMode.HALF_UP)
            } else {
                request.avgPrice
            }
            existing.quantity = mergedQuantity
            existing.avgPrice = mergedAvgPrice
            existing.currentPrice = existing.currentPrice ?: request.avgPrice
            existing.marketValue = mergedQuantity.multiply(existing.currentPrice ?: request.avgPrice)
            existing.unrealizedPnl = calculatePositionPnl(existing.currentPrice ?: request.avgPrice, mergedAvgPrice, mergedQuantity)
            existing
        } else {
            val currentPrice = request.avgPrice
            Position(
                portfolio = portfolio,
                symbol = symbol,
                quantity = request.quantity,
                avgPrice = request.avgPrice,
                currentPrice = currentPrice,
                marketValue = request.quantity.multiply(currentPrice),
                unrealizedPnl = calculatePositionPnl(currentPrice, request.avgPrice, request.quantity),
            )
        }

        val saved = positionRepository.save(position)
        upsertPortfolioHistory(portfolio)
        return AssetRegistrationResponseDto(
            assetId = saved.id!!,
            portfolioId = request.portfolioId,
            symbol = saved.symbol,
            quantity = saved.quantity ?: BigDecimal.ZERO,
            avgPrice = saved.avgPrice ?: BigDecimal.ZERO,
        )
    }

    @Transactional
    fun deleteAsset(assetId: Long): AssetDeleteResponseDto {
        val position = positionRepository.findById(assetId).orElseThrow { ResourceNotFoundException("자산을 찾을 수 없습니다.") }
        val portfolio = position.portfolio
        positionRepository.delete(position)
        if (portfolio != null) {
            upsertPortfolioHistory(portfolio)
        }
        return AssetDeleteResponseDto(assetId = assetId, deleted = true)
    }

    @Transactional(readOnly = true)
    fun getPortfolioDetail(portfolioId: Long): PortfolioDetailDto {
        val portfolio = portfolioRepository.findById(portfolioId).orElseThrow { ResourceNotFoundException("포트폴리오를 찾을 수 없습니다.") }
        val positions = positionRepository.findByPortfolioId(portfolioId)
        return PortfolioDetailDto(
            portfolioId = portfolio.id!!,
            name = portfolio.name,
            baseCurrency = portfolio.baseCurrency,
            status = portfolio.status,
            portfolioValue = calculatePortfolioValue(positions),
            pnl = calculatePnL(positions),
            dailyReturn = calculateDailyReturn(portfolioId),
            positions = positions.mapNotNull { position ->
                val id = position.id ?: return@mapNotNull null
                ManagedPositionDto(
                    id = id,
                    symbol = position.symbol,
                    quantity = position.quantity ?: BigDecimal.ZERO,
                    avgPrice = position.avgPrice ?: BigDecimal.ZERO,
                    currentPrice = position.currentPrice ?: BigDecimal.ZERO,
                    marketValue = position.marketValue ?: BigDecimal.ZERO,
                    pnl = position.unrealizedPnl ?: BigDecimal.ZERO,
                )
            },
        )
    }

    fun getPortfolio(portfolioId: Long): PortfolioSummaryDto {
        val portfolio = portfolioRepository.findById(portfolioId).orElseThrow { ResourceNotFoundException("포트폴리오를 찾을 수 없습니다.") }
        val positions = positionRepository.findByPortfolioId(portfolioId)
        val positionDtos = positions.map {
            PositionDto(it.symbol, it.quantity, it.avgPrice, it.currentPrice, it.marketValue, it.unrealizedPnl)
        }
        val totalMarketValue = positions.mapNotNull { it.marketValue }.fold(BigDecimal.ZERO, BigDecimal::add)
        val totalUnrealizedPnl = positions.mapNotNull { it.unrealizedPnl }.fold(BigDecimal.ZERO, BigDecimal::add)
        return PortfolioSummaryDto(portfolio.id!!, portfolio.name, totalMarketValue, totalUnrealizedPnl, positionDtos)
    }

    private fun resolveDefaultUser() = userRepository.findFirstByStatusOrderByIdAsc("ACTIVE")
        ?: userRepository.save(
            com.gh.quant.platform.domain.entity.User(
                email = "system@quant.local",
                password = "not-used",
                name = "기본 사용자",
                role = "USER",
                status = "ACTIVE",
            ),
        )

    private fun calculatePortfolioValue(positions: List<com.gh.quant.platform.domain.entity.Position>): BigDecimal =
        positions.mapNotNull { it.marketValue }.fold(BigDecimal.ZERO, BigDecimal::add)

    private fun calculatePnL(positions: List<com.gh.quant.platform.domain.entity.Position>): BigDecimal =
        positions.fold(BigDecimal.ZERO) { acc, position ->
            acc.add(
                position.unrealizedPnl
                    ?: calculatePositionPnl(
                        currentPrice = position.currentPrice ?: BigDecimal.ZERO,
                        avgPrice = position.avgPrice ?: BigDecimal.ZERO,
                        quantity = position.quantity ?: BigDecimal.ZERO,
                    ),
            )
        }

    private fun calculatePositionPnl(currentPrice: BigDecimal, avgPrice: BigDecimal, quantity: BigDecimal): BigDecimal =
        currentPrice.subtract(avgPrice).multiply(quantity).setScale(6, RoundingMode.HALF_UP)

    private fun calculateDailyReturn(portfolioId: Long): BigDecimal =
        portfolioHistoryRepository.findTop2ByPortfolioIdOrderByDateDesc(portfolioId)
            .let { history ->
                if (history.size < 2) {
                    BigDecimal.ZERO
                } else {
                    val latest = history[0].portfolioValue ?: BigDecimal.ZERO
                    val previous = history[1].portfolioValue ?: BigDecimal.ZERO
                    if (previous <= BigDecimal.ZERO) {
                        BigDecimal.ZERO
                    } else {
                        latest.subtract(previous)
                            .divide(previous, 6, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100))
                    }
                }
            }

    private fun upsertPortfolioHistory(portfolio: Portfolio) {
        val portfolioId = portfolio.id ?: return
        val positions = positionRepository.findByPortfolioId(portfolioId)
        val value = calculatePortfolioValue(positions)
        val today = LocalDate.now()
        val latestHistory = portfolioHistoryRepository.findTopByPortfolioIdOrderByDateDesc(portfolioId)

        if (latestHistory != null && latestHistory.date == today) {
            latestHistory.portfolioValue = value
            latestHistory.dailyReturn = calculateDailyReturnValue(latestHistory, portfolioId, value)
            portfolioHistoryRepository.save(latestHistory)
            return
        }

        portfolioHistoryRepository.save(
            com.gh.quant.platform.domain.entity.PortfolioHistory(
                portfolio = portfolio,
                date = today,
                portfolioValue = value,
                dailyReturn = calculateDailyReturnValue(latestHistory, portfolioId, value),
            ),
        )
    }

    private fun calculateDailyReturnValue(
        latestHistory: com.gh.quant.platform.domain.entity.PortfolioHistory?,
        portfolioId: Long,
        currentValue: BigDecimal,
    ): BigDecimal {
        val previousValue = when {
            latestHistory == null -> BigDecimal.ZERO
            latestHistory.date == LocalDate.now() ->
                portfolioHistoryRepository.findTop2ByPortfolioIdOrderByDateDesc(portfolioId).getOrNull(1)?.portfolioValue ?: BigDecimal.ZERO
            else -> latestHistory.portfolioValue ?: BigDecimal.ZERO
        }

        if (previousValue <= BigDecimal.ZERO) {
            return BigDecimal.ZERO
        }

        return currentValue.subtract(previousValue)
            .divide(previousValue, 6, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(100))
    }
}

@Service
class OrderService(
    private val tradingOrderRepository: TradingOrderRepository,
    private val portfolioRepository: PortfolioRepository,
) {
    fun getOrders(portfolioId: Long): List<OrderDto> = tradingOrderRepository.findByPortfolioIdOrderBySubmittedAtDesc(portfolioId)
        .map { OrderDto(it.id!!, it.symbol, it.side, it.orderType, it.price, it.quantity, it.status, it.submittedAt) }

    @Transactional
    fun createOrder(request: OrderCreateRequest): OrderDto {
        val portfolio: Portfolio = portfolioRepository.findById(request.portfolioId).orElseThrow { ResourceNotFoundException("포트폴리오를 찾을 수 없습니다.") }
        val saved = tradingOrderRepository.save(
            TradingOrder(
                portfolio = portfolio,
                symbol = request.symbol,
                side = request.side,
                orderType = request.orderType,
                price = request.price,
                quantity = request.quantity,
                status = "PENDING",
                submittedAt = OffsetDateTime.now(),
            ),
        )
        return OrderDto(saved.id!!, saved.symbol, saved.side, saved.orderType, saved.price, saved.quantity, saved.status, saved.submittedAt)
    }

    @Transactional
    fun cancelOrder(orderId: Long): OrderDto {
        val order: TradingOrder = tradingOrderRepository.findById(orderId).orElseThrow { ResourceNotFoundException("주문을 찾을 수 없습니다.") }
        order.status = "CANCELED"
        val saved = tradingOrderRepository.save(order)
        return OrderDto(saved.id!!, saved.symbol, saved.side, saved.orderType, saved.price, saved.quantity, saved.status, saved.submittedAt)
    }
}

@Service
class DataCenterService(
    private val pythonQuantEngineClient: PythonQuantEngineClient,
    private val jobRepository: JobRepository,
) {
    @CacheEvict(value = ["stockLookup"], allEntries = true)
    fun triggerUpdate(request: DataUpdateRequest? = null): Map<String, Any> {
        val payload = request?.let {
            mapOf(
                "preset" to it.preset,
                "symbols" to it.symbols.takeIf(List<String>::isNotEmpty),
                "benchmarkSymbols" to it.benchmarkSymbols.takeIf(List<String>::isNotEmpty),
                "period" to it.period,
                "interval" to it.interval,
            ).filterValues { value -> value != null }.mapValues { (_, value) -> value as Any }
        }
        return pythonQuantEngineClient.triggerDataUpdate(payload)
    }

    fun getStatus(): DataStatusDto {
        val status = pythonQuantEngineClient.getDataStatus()
        val latestPriceDate = status["latestPriceDate"]?.toString()
        val priceRowCount = (status["priceRowCount"] as? Number)?.toLong() ?: 0L
        val latestFundamentalsDate = status["latestFundamentalsDate"]?.toString()
        val fundamentalsRowCount = (status["fundamentalsRowCount"] as? Number)?.toLong() ?: 0L
        val latestBenchmarkDate = status["latestBenchmarkDate"]?.toString()
        val benchmarkRowCount = (status["benchmarkRowCount"] as? Number)?.toLong() ?: 0L
        val latestJobs = status["latestJobs"] as? List<*> ?: emptyList<Any>()
        val dataJobTypes = setOf("data_update_dispatch", "market_data_update", "fundamentals_refresh", "benchmark_sync")
        val dataJobs = latestJobs.mapNotNull { item ->
            val job = item as? Map<*, *> ?: return@mapNotNull null
            val jobType = job["jobType"]?.toString() ?: job["job_type"]?.toString() ?: return@mapNotNull null
            if (jobType !in dataJobTypes) return@mapNotNull null
            job
        }

        val running = dataJobs.count { (it["status"]?.toString() ?: "") == "RUNNING" }
        val completed = dataJobs.count { (it["status"]?.toString() ?: "") == "COMPLETED" }
        val failed = dataJobs.count { (it["status"]?.toString() ?: "") == "FAILED" }

        val latestJobTimes = dataJobs.mapNotNull { job ->
            job["finishedAt"]?.toString() ?: job["startedAt"]?.toString()
        }

        val lastCrawlTime = listOfNotNull(
            latestPriceDate?.let { "${it}T00:00:00Z" },
            latestFundamentalsDate?.let { "${it}T00:00:00Z" },
            latestBenchmarkDate?.let { "${it}T00:00:00Z" },
        ).maxOrNull()
            ?: latestJobTimes.maxOrNull()
            ?: OffsetDateTime.now(ZoneOffset.UTC).toString()

        val sources = listOf(
            DataSourceStatusDto(
                name = "가격 데이터",
                provider = "Python Quant Engine",
                status = if (latestPriceDate != null) "정상" else "지연",
                lastSyncTime = latestPriceDate?.let { "${it}T00:00:00Z" },
                rowCount = priceRowCount,
            ),
            DataSourceStatusDto(
                name = "펀더멘털 데이터",
                provider = "Python Quant Engine",
                status = if (latestFundamentalsDate != null) "정상" else "지연",
                lastSyncTime = latestFundamentalsDate?.let { "${it}T00:00:00Z" },
                rowCount = fundamentalsRowCount,
            ),
            DataSourceStatusDto(
                name = "벤치마크 데이터",
                provider = "Python Quant Engine",
                status = if (latestBenchmarkDate != null) "정상" else "지연",
                lastSyncTime = latestBenchmarkDate?.let { "${it}T00:00:00Z" },
                rowCount = benchmarkRowCount,
            ),
            DataSourceStatusDto(
                name = "잡 상태",
                provider = "Python Quant Engine",
                status = when {
                    failed > 0 -> "오류"
                    running > 0 -> "진행중"
                    completed > 0 -> "정상"
                    else -> "정상"
                },
                lastSyncTime = latestJobTimes.maxOrNull(),
                rowCount = null,
            ),
        )

        val activeJobMap = status["activeJob"] as? Map<*, *>
        val activeJob = activeJobMap?.let { job ->
            ActiveDataJobDto(
                jobId = (job["id"] as? Number)?.toLong()
                    ?: (job["jobId"] as? Number)?.toLong()
                    ?: 0L,
                jobType = job["jobType"]?.toString()
                    ?: job["job_type"]?.toString()
                    ?: "data_update_dispatch",
                status = job["status"]?.toString() ?: "UNKNOWN",
                startedAt = job["startedAt"]?.toString() ?: job["started_at"]?.toString(),
                message = job["message"]?.toString(),
                progressPercent = (job["progressPercent"] as? Number)?.toInt()
                    ?: (job["progress_percent"] as? Number)?.toInt(),
                stage = job["stage"]?.toString(),
                stageLabel = job["stageLabel"]?.toString() ?: job["stage_label"]?.toString(),
                processedCount = (job["processedCount"] as? Number)?.toInt()
                    ?: (job["processed_count"] as? Number)?.toInt(),
                totalCount = (job["totalCount"] as? Number)?.toInt()
                    ?: (job["total_count"] as? Number)?.toInt(),
            )
        } ?: jobRepository.findFirstByJobTypeAndStatusInOrderByCreatedAtDesc(
            "data_update_dispatch",
            listOf("PENDING", "RUNNING"),
        )?.let { activeDispatchJob ->
            ActiveDataJobDto(
                jobId = activeDispatchJob.id ?: 0L,
                jobType = activeDispatchJob.jobType,
                status = activeDispatchJob.status,
                startedAt = activeDispatchJob.startedAt?.toString(),
                message = activeDispatchJob.message,
                progressPercent = null,
                stage = null,
                stageLabel = null,
                processedCount = null,
                totalCount = null,
            )
        }
        val queueStatus = status["queueStatus"]?.toString()
            ?: when (activeJob?.status) {
                "RUNNING" -> "실행중"
                "PENDING" -> "대기"
                else -> "유휴"
            }

        return DataStatusDto(
            lastCrawlTime = lastCrawlTime,
            latestPriceDate = latestPriceDate,
            latestFundamentalsDate = latestFundamentalsDate,
            latestBenchmarkDate = latestBenchmarkDate,
            priceRowCount = priceRowCount,
            fundamentalsRowCount = fundamentalsRowCount,
            benchmarkRowCount = benchmarkRowCount,
            newsIngestionRate = "완료 ${completed}건 / 실행중 ${running}건 / 실패 ${failed}건",
            nlpStatus = if (failed > 0) "점검 필요" else "정상",
            featureGenerationStatus = if (running > 0) "진행중" else "대기",
            sources = sources,
            queueStatus = queueStatus,
            activeJob = activeJob,
        )
    }
}

@Service
class RiskService(private val pythonQuantEngineClient: PythonQuantEngineClient) {
    fun getRisk(portfolioId: Long): RiskSummaryDto {
        val risk = pythonQuantEngineClient.getRisk(portfolioId)
        return RiskSummaryDto(
            `var` = BigDecimal(risk["var"]?.toString() ?: "0"),
            beta = BigDecimal(risk["beta"]?.toString() ?: "0"),
            volatility = BigDecimal(risk["volatility"]?.toString() ?: "0"),
            maxDrawdown = BigDecimal(risk["maxDrawdown"]?.toString() ?: "0"),
        )
    }
}

@Service
class JobService(private val jobRepository: JobRepository) {
    fun getJobs(): List<JobDto> = jobRepository.findTop50ByOrderByCreatedAtDesc()
        .map {
            JobDto(
                id = it.id!!,
                jobType = it.jobType,
                parentJobId = it.parentJob?.id,
                status = it.status,
                startedAt = it.startedAt,
                finishedAt = it.finishedAt,
                message = it.message,
                metadataJson = it.metadataJson,
            )
        }
}

@Service
class NewsIntelligenceService(
    private val newsRepository: NewsRepository,
    private val newsSymbolRepository: NewsSymbolRepository,
    private val eventRepository: EventRepository,
    private val pythonQuantEngineClient: PythonQuantEngineClient,
    private val jdbcTemplate: JdbcTemplate,
) {
    fun getSummary(symbol: String?): NewsIntelligenceDto {
        val selectedSymbol = symbol?.trim()?.uppercase()?.takeIf { it.isNotBlank() }
        if (selectedSymbol != null) {
            primeNewsSymbol(selectedSymbol)
        }
        val totalNewsCount = if (selectedSymbol != null) {
            jdbcTemplate.queryForObject(
                """
                select count(distinct n.id)
                from news n
                join news_symbols ns on ns.news_id = n.id
                where upper(ns.symbol) = ?
                """.trimIndent(),
                Long::class.java,
                selectedSymbol,
            ) ?: 0L
        } else {
            newsRepository.count()
        }

        val averageSentiment = if (selectedSymbol != null) {
            jdbcTemplate.queryForObject(
                """
                select coalesce(avg(n.sentiment_score), 0)
                from news n
                join news_symbols ns on ns.news_id = n.id
                where upper(ns.symbol) = ?
                """.trimIndent(),
                BigDecimal::class.java,
                selectedSymbol,
            ) ?: BigDecimal.ZERO
        } else {
            jdbcTemplate.queryForObject(
                "select coalesce(avg(sentiment_score), 0) from news",
                BigDecimal::class.java,
            ) ?: BigDecimal.ZERO
        }

        val detectedEventCount = countDerivedEvents(selectedSymbol)

        val trendParams = selectedSymbol?.let { arrayOf<Any>(it) } ?: emptyArray()
        val trendSql = if (selectedSymbol != null) {
            """
            select date_trunc('day', n.published_at) as bucket, avg(coalesce(n.sentiment_score, 0)) as avg_sentiment
            from news n
            join news_symbols ns on ns.news_id = n.id
            where upper(ns.symbol) = ?
            group by bucket
            order by bucket desc
            limit 12
            """.trimIndent()
        } else {
            """
            select date_trunc('day', published_at) as bucket, avg(coalesce(sentiment_score, 0)) as avg_sentiment
            from news
            group by bucket
            order by bucket desc
            limit 12
            """.trimIndent()
        }
        val sentimentSeries = jdbcTemplate.query(trendSql, { rs, _ ->
            (rs.getBigDecimal("avg_sentiment") ?: BigDecimal.ZERO).toDouble()
        }, *trendParams).reversed()

        val heatmap = if (sentimentSeries.isNotEmpty()) {
            sentimentSeries.map { ((it + 1.0) / 2.0).coerceIn(0.0, 1.0) }
        } else {
            emptyList()
        }

        val impactStocks = if (selectedSymbol != null) {
            jdbcTemplate.query(
                """
                select ns_related.symbol, count(distinct ns_related.news_id) as news_count, avg(coalesce(n.sentiment_score, 0)) as sentiment
                from news_symbols ns_selected
                join news_symbols ns_related on ns_related.news_id = ns_selected.news_id
                join news n on n.id = ns_related.news_id
                where upper(ns_selected.symbol) = ?
                group by ns_related.symbol
                order by count(distinct ns_related.news_id) desc, avg(coalesce(n.sentiment_score, 0)) desc, ns_related.symbol asc
                limit 5
                """.trimIndent(),
                { rs, _ ->
                    val itemSymbol = rs.getString("symbol")
                    val newsCount = rs.getLong("news_count")
                    val sentiment = rs.getBigDecimal("sentiment") ?: BigDecimal.ZERO
                    ImpactStockDto(
                        symbol = itemSymbol,
                        newsScore = sentiment.multiply(BigDecimal("100")).setScale(0, RoundingMode.HALF_UP).toInt(),
                        sentimentScore = sentiment,
                        newsCount = newsCount,
                    )
                },
                selectedSymbol,
            )
        } else {
            newsSymbolRepository.findImpactStocks(org.springframework.data.domain.PageRequest.of(0, 5))
                .map { row ->
                    val itemSymbol = row[0]?.toString() ?: "N/A"
                    val newsCount = (row[1] as? Long) ?: ((row[1] as? Number)?.toLong() ?: 0L)
                    val sentiment = BigDecimal(row[2]?.toString() ?: "0")
                    ImpactStockDto(symbol = itemSymbol, newsScore = sentiment.multiply(BigDecimal("100")).setScale(0, RoundingMode.HALF_UP).toInt(), sentimentScore = sentiment, newsCount = newsCount)
                }
        }

        return NewsIntelligenceDto(
            selectedSymbol = selectedSymbol,
            scopeLabel = selectedSymbol ?: "전체 시장",
            totalNewsCount = totalNewsCount,
            averageSentiment = averageSentiment,
            detectedEventCount = detectedEventCount,
            heatmap = heatmap,
            sentimentSeries = sentimentSeries,
            impactStocks = impactStocks,
        )
    }

    fun getImpactGraph(symbol: String): NewsImpactGraphDto = pythonQuantEngineClient.getNewsImpactGraph(symbol)

    private fun primeNewsSymbol(symbol: String) {
        pythonQuantEngineClient.syncNewsForSymbolBestEffort(symbol, 20)
    }

    private fun countDerivedEvents(symbol: String?): Long {
        val sql = buildDerivedEventCte(symbol) + """
            select count(*)
            from classified_news
            where event_type is not null
        """.trimIndent()
        return if (symbol != null) {
            jdbcTemplate.queryForObject(sql, Long::class.java, symbol) ?: 0L
        } else {
            jdbcTemplate.queryForObject(sql, Long::class.java) ?: 0L
        }
    }

    private fun buildDerivedEventCte(symbol: String?): String {
        val whereClause = if (symbol != null) "and upper(ns.symbol) = ?" else ""
        return """
            with classified_news as (
                select
                    n.id,
                    upper(ns.symbol) as symbol,
                    n.published_at,
                    case
                        when lower(coalesce(n.title, '') || ' ' || coalesce(n.content, '')) ~ '(earnings beat|beats estimates|raised guidance|surpasses expectations|record revenue|earnings above expectations)' then 'earnings_beat'
                        when lower(coalesce(n.title, '') || ' ' || coalesce(n.content, '')) ~ '(earnings miss|misses estimates|cuts guidance|profit warning|revenue miss)' then 'earnings_miss'
                        when lower(coalesce(n.title, '') || ' ' || coalesce(n.content, '')) ~ '(merger|acquisition|acquire|buyout|takeover|deal to buy|to acquire)' then 'ma_announcement'
                        when lower(coalesce(n.title, '') || ' ' || coalesce(n.content, '')) ~ '((ceo|chief executive|chief financial officer|cfo|chairman).*(resign|step down|retire|appointed|appoints|named|joins))|((appoints|appointed|names|named).*(ceo|chief executive|cfo))' then 'ceo_change'
                        when lower(coalesce(n.title, '') || ' ' || coalesce(n.content, '')) ~ '(regulator|regulatory|antitrust|lawsuit|fine|sec[[:space:]]|fda[[:space:]]|investigation|probe|ban|tariff|sanction)' then 'regulation_news'
                        when lower(coalesce(n.title, '') || ' ' || coalesce(n.content, '')) ~ '(launch|unveil|release|introduce|roll out|partnership|pilot program)' then 'product_launch'
                        when lower(coalesce(n.title, '') || ' ' || coalesce(n.content, '')) ~ '(upgrade|raised target|price target raised|overweight|buy rating)' then 'analyst_upgrade'
                        else null
                    end as event_type
                from news n
                join news_symbols ns on ns.news_id = n.id
                where n.published_at >= now() - interval '180 days'
                $whereClause
            )
        """.trimIndent()
    }
}

@Service
class EventAnalysisService(
    private val eventRepository: EventRepository,
    private val pythonQuantEngineClient: PythonQuantEngineClient,
    private val jdbcTemplate: JdbcTemplate,
) {
    fun getSummary(symbol: String?): EventAnalysisDto {
        val selectedSymbol = symbol?.trim()?.uppercase()?.takeIf { it.isNotBlank() }
        if (selectedSymbol != null) {
            pythonQuantEngineClient.syncNewsForSymbolBestEffort(selectedSymbol, 30)
        }
        val reactionsSql = buildPricedEventCte(selectedSymbol) + """
            select
                event_type,
                avg(
                    case
                        when base_close is null or base_close = 0 then null
                        when close_t5 is not null then ((close_t5 / base_close) - 1) * 100
                        when close_t1 is not null then ((close_t1 / base_close) - 1) * 100
                        when close_t20 is not null then ((close_t20 / base_close) - 1) * 100
                        else null
                    end
                ) as average_reaction,
                count(*) as recent_count
            from priced_events
            group by event_type
            order by count(*) desc, event_type asc
        """.trimIndent()
        val reactions = if (selectedSymbol != null) {
            jdbcTemplate.query(
                reactionsSql,
                { rs, _ ->
                    EventReactionDto(
                        eventType = toEventLabel(rs.getString("event_type")),
                        averageReaction = rs.getBigDecimal("average_reaction") ?: BigDecimal.ZERO,
                        recentCount = rs.getInt("recent_count"),
                    )
                },
                selectedSymbol,
            )
        } else {
            jdbcTemplate.query(
                reactionsSql,
                { rs, _ ->
                    EventReactionDto(
                        eventType = toEventLabel(rs.getString("event_type")),
                        averageReaction = rs.getBigDecimal("average_reaction") ?: BigDecimal.ZERO,
                        recentCount = rs.getInt("recent_count"),
                    )
                },
            )
        }

        val reactionByType = reactions.associateBy { it.eventType }
        val priceSeriesSql = buildPricedEventCte(selectedSymbol) + """
            select coalesce(
                case
                    when base_close is null or base_close = 0 then null
                    when close_t5 is not null then ((close_t5 / base_close) - 1) * 100
                    when close_t1 is not null then ((close_t1 / base_close) - 1) * 100
                    when close_t20 is not null then ((close_t20 / base_close) - 1) * 100
                    else null
                end,
                0
            ) as reaction
            from priced_events
            order by published_at desc
            limit 10
        """.trimIndent()
        val priceReactionSeries = if (selectedSymbol != null) {
            jdbcTemplate.query(
                priceSeriesSql,
                { rs, _ -> (rs.getBigDecimal("reaction") ?: BigDecimal.ZERO).toDouble() },
                selectedSymbol,
            )
        } else {
            jdbcTemplate.query(
                priceSeriesSql,
                { rs, _ -> (rs.getBigDecimal("reaction") ?: BigDecimal.ZERO).toDouble() },
            )
        }.reversed()

        return EventAnalysisDto(
            selectedSymbol = selectedSymbol,
            scopeLabel = selectedSymbol ?: "전체 시장",
            earningsBeat = reactionByType["실적 서프라이즈"]?.averageReaction ?: BigDecimal.ZERO,
            maAnnouncement = reactionByType["인수합병"]?.averageReaction ?: BigDecimal.ZERO,
            ceoChange = reactionByType["CEO 변경"]?.averageReaction ?: BigDecimal.ZERO,
            regulation = reactionByType["규제"]?.averageReaction ?: BigDecimal.ZERO,
            priceReactionSeries = priceReactionSeries,
            reactions = reactions.ifEmpty {
                emptyList()
            },
        )
    }

    private fun toEventLabel(type: String): String = when (type.lowercase()) {
        "earnings_beat" -> "실적 서프라이즈"
        "earnings_miss" -> "실적 부진"
        "ma_announcement" -> "인수합병"
        "ceo_change" -> "CEO 변경"
        "regulation_news" -> "규제"
        "product_launch" -> "제품 출시"
        "analyst_upgrade" -> "애널리스트 상향"
        else -> type.replace("_", " ").replaceFirstChar { it.uppercase() }
    }

    private fun buildPricedEventCte(symbol: String?): String {
        val whereClause = if (symbol != null) "and upper(ns.symbol) = ?" else ""
        return """
            with classified_news as (
                select
                    n.id,
                    upper(ns.symbol) as symbol,
                    n.published_at,
                    case
                        when lower(coalesce(n.title, '') || ' ' || coalesce(n.content, '')) ~ '(earnings beat|beats estimates|raised guidance|surpasses expectations|record revenue|earnings above expectations)' then 'earnings_beat'
                        when lower(coalesce(n.title, '') || ' ' || coalesce(n.content, '')) ~ '(earnings miss|misses estimates|cuts guidance|profit warning|revenue miss)' then 'earnings_miss'
                        when lower(coalesce(n.title, '') || ' ' || coalesce(n.content, '')) ~ '(merger|acquisition|acquire|buyout|takeover|deal to buy|to acquire)' then 'ma_announcement'
                        when lower(coalesce(n.title, '') || ' ' || coalesce(n.content, '')) ~ '((ceo|chief executive|chief financial officer|cfo|chairman).*(resign|step down|retire|appointed|appoints|named|joins))|((appoints|appointed|names|named).*(ceo|chief executive|cfo))' then 'ceo_change'
                        when lower(coalesce(n.title, '') || ' ' || coalesce(n.content, '')) ~ '(regulator|regulatory|antitrust|lawsuit|fine|sec[[:space:]]|fda[[:space:]]|investigation|probe|ban|tariff|sanction)' then 'regulation_news'
                        when lower(coalesce(n.title, '') || ' ' || coalesce(n.content, '')) ~ '(launch|unveil|release|introduce|roll out|partnership|pilot program)' then 'product_launch'
                        when lower(coalesce(n.title, '') || ' ' || coalesce(n.content, '')) ~ '(upgrade|raised target|price target raised|overweight|buy rating)' then 'analyst_upgrade'
                        else null
                    end as event_type
                from news n
                join news_symbols ns on ns.news_id = n.id
                where n.published_at >= now() - interval '180 days'
                $whereClause
            ),
            priced_events as (
                select
                    cn.id,
                    cn.symbol,
                    cn.event_type,
                    cn.published_at,
                    base_price.close as base_close,
                    t1.close as close_t1,
                    t5.close as close_t5,
                    t20.close as close_t20
                from classified_news cn
                left join lateral (
                    select p.close
                    from prices p
                    where p.symbol = cn.symbol
                      and p.date <= cn.published_at::date
                    order by p.date desc
                    limit 1
                ) base_price on true
                left join lateral (
                    select p.close
                    from prices p
                    where p.symbol = cn.symbol
                      and p.date > cn.published_at::date
                    order by p.date asc
                    limit 1 offset 0
                ) t1 on true
                left join lateral (
                    select p.close
                    from prices p
                    where p.symbol = cn.symbol
                      and p.date > cn.published_at::date
                    order by p.date asc
                    limit 1 offset 4
                ) t5 on true
                left join lateral (
                    select p.close
                    from prices p
                    where p.symbol = cn.symbol
                      and p.date > cn.published_at::date
                    order by p.date asc
                    limit 1 offset 19
                ) t20 on true
                where cn.event_type is not null
            )
        """.trimIndent()
    }
}

@Service
class AlternativeDataCenterService(
    private val jdbcTemplate: JdbcTemplate,
) {
    fun getSummary(): AlternativeDataCenterDto {
        val newsCount = jdbcTemplate.queryForObject("select count(*) from news", Long::class.java) ?: 0L
        val eventCount = jdbcTemplate.queryForObject("select count(*) from events", Long::class.java) ?: 0L
        val newsLastCollected = jdbcTemplate.queryForObject("select max(published_at)::text from news", String::class.java)
        val eventLastCollected = jdbcTemplate.queryForObject("select max(event_date)::text from events", String::class.java)

        val datasets = listOf(
            AlternativeDatasetDto(
                dataset = "뉴스 데이터",
                provider = "NewsAPI / Python Quant Engine",
                lastCollectedAt = newsLastCollected,
                recordCount = newsCount,
                status = if (newsCount > 0) "정상" else "미수집",
            ),
            AlternativeDatasetDto(
                dataset = "소셜 미디어 데이터",
                provider = "미구성",
                lastCollectedAt = null,
                recordCount = 0,
                status = "미수집",
            ),
            AlternativeDatasetDto(
                dataset = "검색 트렌드 데이터",
                provider = "미구성",
                lastCollectedAt = null,
                recordCount = 0,
                status = "미수집",
            ),
            AlternativeDatasetDto(
                dataset = "매크로 이벤트 데이터",
                provider = "Python Quant Engine",
                lastCollectedAt = eventLastCollected,
                recordCount = eventCount,
                status = if (eventCount > 0) "정상" else "미수집",
            ),
        )

        return AlternativeDataCenterDto(
            totalDatasets = datasets.size,
            activeDatasets = datasets.count { it.recordCount > 0 },
            totalRecords = datasets.sumOf { it.recordCount },
            datasets = datasets,
        )
    }
}
