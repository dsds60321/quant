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

data class BacktestResultDto(
    val backtestId: Long,
    val cagr: java.math.BigDecimal?,
    val sharpe: java.math.BigDecimal?,
    val maxDrawdown: java.math.BigDecimal?,
    val winRate: java.math.BigDecimal?,
    val equityCurve: List<SeriesPointDto> = emptyList(),
    val drawdownCurve: List<SeriesPointDto> = emptyList(),
    val monthlyReturns: List<SeriesPointDto> = emptyList(),
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
    val rebalanceCount: Int?,
    val averageSelectionCount: Double?,
    val latestSelectionCount: Int?,
    val startedAt: OffsetDateTime?,
    val finishedAt: OffsetDateTime?,
)

data class BacktestHistoryItemDto(
    val backtestId: Long,
    val strategyId: Long,
    val strategyName: String,
    val snapshotId: Long?,
    val snapshotName: String?,
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
