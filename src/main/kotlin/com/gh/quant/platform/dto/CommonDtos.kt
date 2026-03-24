package com.gh.quant.platform.dto

import java.time.OffsetDateTime

data class ApiResponse<T>(
    val success: Boolean,
    val data: T? = null,
    val message: String? = null,
    val timestamp: OffsetDateTime = OffsetDateTime.now(),
) {
    companion object {
        fun <T> ok(data: T, message: String? = null): ApiResponse<T> = ApiResponse(success = true, data = data, message = message)
        fun fail(message: String): ApiResponse<Nothing> = ApiResponse(success = false, message = message)
    }
}

data class DashboardSummaryDto(
    val portfolioValue: java.math.BigDecimal,
    val dailyReturn: java.math.BigDecimal,
    val sharpe: java.math.BigDecimal,
    val alpha: java.math.BigDecimal,
    val maxDrawdown: java.math.BigDecimal,
    val activeStrategies: Long,
)

data class MarketIndexDto(
    val symbol: String,
    val name: String,
    val lastPrice: java.math.BigDecimal,
    val changePercent: java.math.BigDecimal,
    val series: List<java.math.BigDecimal> = emptyList(),
    val rangeSeries: Map<String, List<java.math.BigDecimal>> = emptyMap(),
    val candles: List<MarketCandleDto> = emptyList(),
    val rangeCandles: Map<String, List<MarketCandleDto>> = emptyMap(),
)

data class MarketCandleDto(
    val date: java.time.LocalDate,
    val open: java.math.BigDecimal,
    val high: java.math.BigDecimal,
    val low: java.math.BigDecimal,
    val close: java.math.BigDecimal,
    val volume: Long,
)

data class MarketSectorDto(
    val sector: String,
    val changePercent: java.math.BigDecimal,
    val stockCount: Int,
)

data class FactorCandidateDto(
    val symbol: String,
    val score: java.math.BigDecimal,
)

data class StrategyCandidateDiagnosticsDto(
    val totalSymbols: Int,
    val priceReadyCount: Int,
    val fundamentalsReadyCount: Int,
    val roePassCount: Int,
    val pbrPassCount: Int,
    val momentumPassCount: Int,
    val finalSelectedCount: Int,
)

data class StrategyCreateResponse(
    val strategyId: Long,
    val candidates: List<FactorCandidateDto>,
    val diagnostics: StrategyCandidateDiagnosticsDto,
    val analysisJobId: Long? = null,
    val analysisStatus: String? = null,
    val analysisMessage: String? = null,
)

data class StrategyDiagnosticsDto(
    val strategyId: Long,
    val candidates: List<FactorCandidateDto>,
    val diagnostics: StrategyCandidateDiagnosticsDto,
    val analysisJobId: Long? = null,
    val analysisStatus: String? = null,
    val analysisMessage: String? = null,
)

data class StrategyWeightSnapshotDto(
    val snapshotId: Long,
    val strategyId: Long,
    val name: String,
    val factorWeightMode: String,
    val factorWeights: Map<String, java.math.BigDecimal>,
    val createdAt: OffsetDateTime,
)

data class BacktestSnapshotDto(
    val backtestId: Long,
    val snapshotId: Long?,
    val snapshotName: String?,
    val startDate: java.time.LocalDate?,
    val endDate: java.time.LocalDate?,
    val cagr: java.math.BigDecimal?,
    val sharpe: java.math.BigDecimal?,
    val maxDrawdown: java.math.BigDecimal?,
    val winRate: java.math.BigDecimal?,
    val createdAt: OffsetDateTime,
)

data class StrategySummaryDto(
    val strategyId: Long,
    val name: String,
    val description: String?,
    val roe: java.math.BigDecimal?,
    val pbr: java.math.BigDecimal?,
    val momentum: java.math.BigDecimal?,
    val stockCount: Int?,
    val rebalance: String?,
    val weightingMethod: String?,
    val factorWeightMode: String,
    val factorWeights: Map<String, java.math.BigDecimal>,
    val universeScope: BacktestUniverseScopeDto? = null,
    val status: String,
    val createdAt: OffsetDateTime,
    val latestBacktest: BacktestSnapshotDto?,
)

data class ScreenerStockDto(
    val symbol: String,
    val name: String,
    val per: java.math.BigDecimal?,
    val roe: java.math.BigDecimal?,
    val marketCap: java.math.BigDecimal?,
)

data class StockLookupDto(
    val symbol: String,
    val name: String,
    val exchange: String,
    val marketType: String,
    val assetGroup: String,
    val currency: String,
    val marketCap: java.math.BigDecimal?,
)

data class StockDataPricePointDto(
    val date: java.time.LocalDate,
    val open: java.math.BigDecimal?,
    val high: java.math.BigDecimal?,
    val low: java.math.BigDecimal?,
    val close: java.math.BigDecimal?,
    val adjClose: java.math.BigDecimal?,
    val volume: Long,
)

data class StockDataFundamentalPointDto(
    val date: java.time.LocalDate,
    val per: java.math.BigDecimal?,
    val pbr: java.math.BigDecimal?,
    val roe: java.math.BigDecimal?,
    val eps: java.math.BigDecimal?,
    val dividendYield: java.math.BigDecimal?,
    val marketCap: java.math.BigDecimal?,
    val revenue: java.math.BigDecimal?,
    val netIncome: java.math.BigDecimal?,
)

data class StockDataNewsItemDto(
    val title: String,
    val source: String,
    val publishedAt: String?,
    val sentimentScore: java.math.BigDecimal?,
    val impactScore: java.math.BigDecimal?,
    val url: String,
)

data class StockDataEventItemDto(
    val eventType: String,
    val eventDate: String?,
    val description: String?,
    val priceT1: java.math.BigDecimal?,
    val priceT5: java.math.BigDecimal?,
    val priceT20: java.math.BigDecimal?,
)

data class StockDataDetailDto(
    val symbol: String,
    val name: String,
    val exchange: String,
    val currency: String,
    val sector: String?,
    val industry: String?,
    val marketCap: java.math.BigDecimal?,
    val latestPriceDate: String?,
    val latestPrice: java.math.BigDecimal?,
    val previousClose: java.math.BigDecimal?,
    val changePercent: java.math.BigDecimal?,
    val priceRowCount: Long,
    val fundamentalsRowCount: Long,
    val newsCount: Long,
    val eventCount: Long,
    val priceSeries: List<StockDataPricePointDto>,
    val fundamentals: List<StockDataFundamentalPointDto>,
    val news: List<StockDataNewsItemDto>,
    val events: List<StockDataEventItemDto>,
)

data class PositionDto(
    val symbol: String,
    val quantity: java.math.BigDecimal?,
    val avgPrice: java.math.BigDecimal?,
    val currentPrice: java.math.BigDecimal?,
    val marketValue: java.math.BigDecimal?,
    val unrealizedPnl: java.math.BigDecimal?,
)

data class PortfolioSummaryDto(
    val portfolioId: Long,
    val portfolioName: String,
    val totalMarketValue: java.math.BigDecimal,
    val totalUnrealizedPnl: java.math.BigDecimal,
    val positions: List<PositionDto>,
)

data class PortfolioCreateResponseDto(
    val portfolioId: Long,
)

data class ManagedPositionDto(
    val id: Long,
    val symbol: String,
    val quantity: java.math.BigDecimal,
    val avgPrice: java.math.BigDecimal,
    val currentPrice: java.math.BigDecimal,
    val marketValue: java.math.BigDecimal,
    val pnl: java.math.BigDecimal,
)

data class PortfolioListItemDto(
    val portfolioId: Long,
    val name: String,
    val baseCurrency: String,
    val status: String,
    val portfolioValue: java.math.BigDecimal,
    val pnl: java.math.BigDecimal,
    val dailyReturn: java.math.BigDecimal,
    val positionCount: Int,
)

data class PortfolioDetailDto(
    val portfolioId: Long,
    val name: String,
    val baseCurrency: String,
    val status: String,
    val portfolioValue: java.math.BigDecimal,
    val pnl: java.math.BigDecimal,
    val dailyReturn: java.math.BigDecimal,
    val positions: List<ManagedPositionDto>,
)

data class AssetRegistrationResponseDto(
    val assetId: Long,
    val portfolioId: Long,
    val symbol: String,
    val quantity: java.math.BigDecimal,
    val avgPrice: java.math.BigDecimal,
)

data class AssetDeleteResponseDto(
    val assetId: Long,
    val deleted: Boolean,
)

data class DeleteResponseDto(
    val id: Long,
    val deleted: Boolean,
)

data class OrderDto(
    val id: Long,
    val symbol: String,
    val side: String,
    val orderType: String,
    val price: java.math.BigDecimal?,
    val quantity: java.math.BigDecimal?,
    val status: String,
    val submittedAt: OffsetDateTime?,
)

data class DataSourceStatusDto(
    val name: String,
    val provider: String,
    val status: String,
    val lastSyncTime: String?,
    val rowCount: Long? = null,
)

data class ActiveDataJobDto(
    val jobId: Long,
    val jobType: String,
    val status: String,
    val startedAt: String?,
    val message: String?,
    val progressPercent: Int?,
    val stage: String?,
    val stageLabel: String?,
    val processedCount: Int?,
    val totalCount: Int?,
)

data class DataStatusDto(
    val lastCrawlTime: String,
    val latestPriceDate: String?,
    val latestFundamentalsDate: String?,
    val latestBenchmarkDate: String?,
    val priceRowCount: Long,
    val fundamentalsRowCount: Long,
    val benchmarkRowCount: Long,
    val newsIngestionRate: String,
    val nlpStatus: String,
    val featureGenerationStatus: String,
    val sources: List<DataSourceStatusDto>,
    val queueStatus: String,
    val activeJob: ActiveDataJobDto?,
)

data class RiskSummaryDto(
    val `var`: java.math.BigDecimal,
    val beta: java.math.BigDecimal,
    val volatility: java.math.BigDecimal,
    val maxDrawdown: java.math.BigDecimal,
)

data class JobDto(
    val id: Long,
    val jobType: String,
    val parentJobId: Long?,
    val status: String,
    val startedAt: OffsetDateTime?,
    val finishedAt: OffsetDateTime?,
    val message: String?,
    val metadataJson: String?,
)

data class SeriesPointDto(
    val date: String,
    val value: java.math.BigDecimal,
)

data class BacktestUniverseStockDto(
    val symbol: String,
    val name: String,
    val exchange: String? = null,
    val marketType: String? = null,
    val assetGroup: String? = null,
)

data class BacktestUniverseScopeDto(
    val overrideMode: String = "STRATEGY_DEFAULT",
    val mode: String = "FULL_MARKET",
    val marketScope: String = "STRATEGY_DEFAULT",
    val assetScope: String = "STRATEGY_DEFAULT",
    val selectedStocks: List<BacktestUniverseStockDto> = emptyList(),
    val selectedSectors: List<String> = emptyList(),
    val selectedThemes: List<String> = emptyList(),
    val portfolioSource: String = "SAVED_PORTFOLIO",
    val portfolioKey: String? = null,
    val portfolioId: Long? = null,
    val portfolioName: String? = null,
    val estimatedStockCount: Int? = null,
    val lastUpdatedAt: String? = null,
)

data class BacktestResultDto(
    val backtestId: Long,
    val cagr: java.math.BigDecimal?,
    val sharpe: java.math.BigDecimal?,
    val maxDrawdown: java.math.BigDecimal?,
    val winRate: java.math.BigDecimal?,
    val universeScope: BacktestUniverseScopeDto? = null,
    val equityCurve: List<SeriesPointDto> = emptyList(),
    val drawdownCurve: List<SeriesPointDto> = emptyList(),
    val monthlyReturns: List<SeriesPointDto> = emptyList(),
    val stockBreakdown: List<BacktestStockBreakdownDto> = emptyList(),
    val patternBreakdown: List<BacktestPatternBreakdownDto> = emptyList(),
    val tradeLog: List<BacktestTradeLogItemDto> = emptyList(),
    val signalTimeline: List<BacktestSignalTimelineItemDto> = emptyList(),
    val researchConfig: BacktestResearchConfigDto? = null,
)

data class BacktestStockBreakdownDto(
    val symbol: String,
    val weight: java.math.BigDecimal,
    val returnPercent: java.math.BigDecimal,
    val contributionPercent: java.math.BigDecimal,
    val winRatePercent: java.math.BigDecimal?,
    val drawdownPercent: java.math.BigDecimal?,
    val signal: String?,
    val entryDate: String?,
    val exitDate: String?,
    val holdingDays: Int?,
    val activePatterns: List<String> = emptyList(),
    val note: String?,
)

data class BacktestPatternBreakdownDto(
    val name: String,
    val sampleSize: Int,
    val avgReturnPercent: java.math.BigDecimal,
    val sharpe: java.math.BigDecimal?,
    val maxDrawdownPercent: java.math.BigDecimal?,
    val winRatePercent: java.math.BigDecimal?,
    val avgHoldingDays: Int?,
    val turnoverPercent: java.math.BigDecimal?,
    val status: String?,
)

data class BacktestTradeLogItemDto(
    val date: String,
    val symbol: String,
    val action: String,
    val patternId: String?,
    val pattern: String?,
    val signalDate: String?,
    val signalPrice: java.math.BigDecimal?,
    val triggerPrice: java.math.BigDecimal?,
    val recommendedBuyPrice: java.math.BigDecimal?,
    val entryRangeLow: java.math.BigDecimal?,
    val entryRangeHigh: java.math.BigDecimal?,
    val entryDistancePercent: java.math.BigDecimal?,
    val entryAllowed: Boolean?,
    val stopPrice: java.math.BigDecimal?,
    val trailingStopPrice: java.math.BigDecimal?,
    val targetPrice1: java.math.BigDecimal?,
    val targetPrice2: java.math.BigDecimal?,
    val recommendedSellPrice: java.math.BigDecimal?,
    val expectedExitPrice: java.math.BigDecimal?,
    val expectedReturnPercent: java.math.BigDecimal?,
    val expectedReturnPercent2: java.math.BigDecimal?,
    val riskReward: java.math.BigDecimal?,
    val executionLabel: String?,
    val signalReason: String?,
    val exitReason: String?,
    val currentState: String?,
    val currentPrice: java.math.BigDecimal?,
    val openPosition: Boolean?,
    val entryDate: String?,
    val entryPrice: java.math.BigDecimal?,
    val exitDate: String?,
    val exitPrice: java.math.BigDecimal?,
    val note: String?,
    val returnPercent: java.math.BigDecimal?,
    val holdingDays: Int?,
    val mfePercent: java.math.BigDecimal?,
    val maePercent: java.math.BigDecimal?,
    val detectionStartDate: String?,
    val detectionEndDate: String?,
)

data class BacktestSignalTimelineItemDto(
    val date: String,
    val symbol: String,
    val signal: String,
    val patternId: String?,
    val pattern: String?,
    val signalPrice: java.math.BigDecimal?,
    val triggerPrice: java.math.BigDecimal?,
    val recommendedBuyPrice: java.math.BigDecimal?,
    val entryRangeLow: java.math.BigDecimal?,
    val entryRangeHigh: java.math.BigDecimal?,
    val entryDistancePercent: java.math.BigDecimal?,
    val entryAllowed: Boolean?,
    val stopPrice: java.math.BigDecimal?,
    val trailingStopPrice: java.math.BigDecimal?,
    val targetPrice1: java.math.BigDecimal?,
    val targetPrice2: java.math.BigDecimal?,
    val recommendedSellPrice: java.math.BigDecimal?,
    val expectedExitPrice: java.math.BigDecimal?,
    val expectedReturnPercent: java.math.BigDecimal?,
    val expectedReturnPercent2: java.math.BigDecimal?,
    val riskReward: java.math.BigDecimal?,
    val executionLabel: String?,
    val signalReason: String?,
    val exitReason: String?,
    val currentState: String?,
    val currentPrice: java.math.BigDecimal?,
    val openPosition: Boolean?,
    val entryDate: String?,
    val entryPrice: java.math.BigDecimal?,
    val exitDate: String?,
    val exitPrice: java.math.BigDecimal?,
    val status: String?,
    val note: String?,
    val returnPercent: java.math.BigDecimal?,
    val holdingDays: Int?,
    val mfePercent: java.math.BigDecimal?,
    val maePercent: java.math.BigDecimal?,
    val detectionStartDate: String?,
    val detectionEndDate: String?,
)

data class BacktestResearchConfigDto(
    val patternDefinitions: List<BacktestPatternDefinitionDto> = emptyList(),
    val signalPlan: BacktestSignalPlanDto? = null,
)

data class BacktestPatternDefinitionDto(
    val id: String,
    val name: String,
    val shortLabel: String?,
    val category: String,
    val thesis: String?,
    val ruleSummary: String?,
    val lookbackDays: Int,
    val breakoutPercent: java.math.BigDecimal,
    val holdingDays: Int,
    val momentumThreshold: java.math.BigDecimal,
    val slopeThreshold: java.math.BigDecimal,
    val volumeSurgePercent: java.math.BigDecimal? = null,
    val sweepBufferPercent: java.math.BigDecimal? = null,
    val maxReentryBars: Int? = null,
    val wickRatioThreshold: java.math.BigDecimal? = null,
    val closeRecoveryPercent: java.math.BigDecimal? = null,
    val minGapPercent: java.math.BigDecimal? = null,
    val minFillPercent: java.math.BigDecimal? = null,
    val maxConfirmationBars: Int? = null,
    val stopLossPercent: java.math.BigDecimal? = null,
    val target1Percent: java.math.BigDecimal? = null,
    val target2Percent: java.math.BigDecimal? = null,
    val entryMode: String? = null,
    val exitMode: String? = null,
    val enabled: Boolean,
    val source: String,
)

data class BacktestSignalPlanDto(
    val buyMode: String,
    val sellMode: String,
    val holdMode: String,
    val maxHoldingDays: Int,
    val stopLossPercent: java.math.BigDecimal,
    val takeProfitPercent: java.math.BigDecimal,
    val rebalanceGuard: String,
)

data class BacktestQueueResponseDto(
    val accepted: Boolean,
    val jobId: Long?,
    val status: String,
    val message: String,
)

data class BacktestJobStatusDto(
    val jobId: Long,
    val status: String,
    val message: String?,
    val backtestId: Long?,
    val strategyId: Long?,
    val snapshotId: Long?,
    val startDate: String?,
    val endDate: String?,
    val universeScope: BacktestUniverseScopeDto?,
    val rebalanceCount: Int?,
    val averageSelectionCount: Double?,
    val latestSelectionCount: Int?,
    val progressPercent: Int?,
    val stage: String?,
    val stageLabel: String?,
    val processedCount: Int?,
    val totalCount: Int?,
    val startedAt: OffsetDateTime?,
    val finishedAt: OffsetDateTime?,
    val updatedAt: OffsetDateTime?,
)

data class BacktestHistoryItemDto(
    val backtestId: Long,
    val strategyId: Long,
    val strategyName: String,
    val snapshotId: Long?,
    val snapshotName: String?,
    val universeScope: BacktestUniverseScopeDto? = null,
    val startDate: String?,
    val endDate: String?,
    val cagr: java.math.BigDecimal?,
    val sharpe: java.math.BigDecimal?,
    val maxDrawdown: java.math.BigDecimal?,
    val winRate: java.math.BigDecimal?,
    val createdAt: OffsetDateTime,
)

data class StrategyRunDto(
    val id: Long,
    val strategyId: Long,
    val strategyName: String,
    val portfolioId: Long,
    val status: String,
    val startedAt: OffsetDateTime?,
    val finishedAt: OffsetDateTime?,
)

data class StrategyOptimizationHistoryDto(
    val id: Long,
    val strategyId: Long,
    val strategyName: String,
    val parameterName: String,
    val objective: String,
    val benchmarkSymbol: String?,
    val status: String,
    val startDate: String?,
    val endDate: String?,
    val createdAt: OffsetDateTime,
    val bestParametersJson: String?,
    val resultJson: String?,
)

data class StrategyComparisonHistoryDto(
    val id: Long,
    val benchmarkSymbol: String,
    val strategyIdsJson: String,
    val status: String,
    val startDate: String?,
    val endDate: String?,
    val createdAt: OffsetDateTime,
    val resultJson: String?,
)

data class ImpactStockDto(
    val symbol: String,
    val newsScore: Int,
    val sentimentScore: java.math.BigDecimal,
    val newsCount: Long,
)

data class NewsIntelligenceDto(
    val selectedSymbol: String?,
    val scopeLabel: String,
    val totalNewsCount: Long,
    val averageSentiment: java.math.BigDecimal,
    val detectedEventCount: Long,
    val heatmap: List<Double>,
    val sentimentSeries: List<Double>,
    val impactStocks: List<ImpactStockDto>,
)

data class EventReactionDto(
    val eventType: String,
    val averageReaction: java.math.BigDecimal,
    val recentCount: Int,
)

data class EventAnalysisDto(
    val selectedSymbol: String?,
    val scopeLabel: String,
    val earningsBeat: java.math.BigDecimal,
    val maAnnouncement: java.math.BigDecimal,
    val ceoChange: java.math.BigDecimal,
    val regulation: java.math.BigDecimal,
    val priceReactionSeries: List<Double>,
    val reactions: List<EventReactionDto>,
)

data class AlternativeDatasetDto(
    val dataset: String,
    val provider: String,
    val lastCollectedAt: String?,
    val recordCount: Long,
    val status: String,
)

data class AlternativeDataCenterDto(
    val totalDatasets: Int,
    val activeDatasets: Int,
    val totalRecords: Long,
    val datasets: List<AlternativeDatasetDto>,
)

data class NewsImpactNodeDto(
    val id: Long,
    val title: String,
    val summary: String?,
    val translatedTitle: String?,
    val translatedSummary: String?,
    val sentiment: String,
    val impact: java.math.BigDecimal,
    val distance: java.math.BigDecimal,
    val color: String,
    val publishedAt: String?,
    val source: String?,
    val url: String?,
)

data class NewsImpactLinkDto(
    val source: String,
    val target: String,
    val distance: java.math.BigDecimal,
)

data class NewsImpactGraphDto(
    val center: String,
    val sentimentScore: java.math.BigDecimal,
    val generatedAt: String,
    val nodes: List<NewsImpactNodeDto>,
    val links: List<NewsImpactLinkDto>,
)
