package com.gh.quant.platform.dto

import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull
import java.math.BigDecimal
import java.time.LocalDate

data class StrategyFactorWeightRequest(
    @field:NotEmpty val factorName: String,
    @field:NotNull val factorWeight: BigDecimal,
)

data class StrategyCreateRequest(
    @field:NotEmpty val name: String,
    @field:NotNull val roe: BigDecimal,
    @field:NotNull val pbr: BigDecimal,
    @field:NotNull val momentum: BigDecimal,
    @field:NotNull val stockCount: Int,
    @field:NotNull val rebalance: String,
    val factorWeightMode: String = "AUTO",
    val factorWeights: List<StrategyFactorWeightRequest> = emptyList(),
    val universeScope: BacktestUniverseScopeRequest? = null,
)

data class StrategyUpdateRequest(
    @field:NotEmpty val name: String,
    @field:NotNull val roe: BigDecimal,
    @field:NotNull val pbr: BigDecimal,
    @field:NotNull val momentum: BigDecimal,
    @field:NotNull val stockCount: Int,
    @field:NotNull val rebalance: String,
    val factorWeightMode: String = "AUTO",
    val factorWeights: List<StrategyFactorWeightRequest> = emptyList(),
    val universeScope: BacktestUniverseScopeRequest? = null,
)

data class BacktestUniverseStockRequest(
    @field:NotEmpty val symbol: String,
    @field:NotEmpty val name: String,
    val exchange: String? = null,
    val marketType: String? = null,
    val assetGroup: String? = null,
)

data class BacktestUniverseScopeRequest(
    @field:NotEmpty val overrideMode: String = "STRATEGY_DEFAULT",
    @field:NotEmpty val mode: String = "FULL_MARKET",
    @field:NotEmpty val marketScope: String = "STRATEGY_DEFAULT",
    @field:NotEmpty val assetScope: String = "STRATEGY_DEFAULT",
    val selectedStocks: List<BacktestUniverseStockRequest> = emptyList(),
    val selectedSectors: List<String> = emptyList(),
    val selectedThemes: List<String> = emptyList(),
    @field:NotEmpty val portfolioSource: String = "SAVED_PORTFOLIO",
    val portfolioKey: String? = null,
    val portfolioId: Long? = null,
    val portfolioName: String? = null,
    val estimatedStockCount: Int? = null,
    val lastUpdatedAt: String? = null,
)

data class BacktestRequest(
    @field:NotNull val strategyId: Long,
    @field:NotNull val startDate: LocalDate,
    @field:NotNull val endDate: LocalDate,
    val snapshotId: Long? = null,
    val universeScope: BacktestUniverseScopeRequest? = null,
    val patternDefinitions: List<BacktestPatternDefinitionRequest> = emptyList(),
    val signalPlan: BacktestSignalPlanRequest? = null,
)

data class BacktestPatternDefinitionRequest(
    @field:NotEmpty val id: String,
    @field:NotEmpty val name: String,
    val shortLabel: String? = null,
    @field:NotEmpty val category: String,
    val thesis: String? = null,
    val ruleSummary: String? = null,
    @field:NotNull val lookbackDays: Int = 55,
    @field:NotNull val breakoutPercent: BigDecimal = BigDecimal("1.0"),
    @field:NotNull val holdingDays: Int = 30,
    @field:NotNull val momentumThreshold: BigDecimal = BigDecimal("10"),
    @field:NotNull val slopeThreshold: BigDecimal = BigDecimal("0.2"),
    @field:NotNull val volumeSurgePercent: BigDecimal = BigDecimal("12"),
    @field:NotNull val sweepBufferPercent: BigDecimal = BigDecimal("0.4"),
    @field:NotNull val maxReentryBars: Int = 2,
    @field:NotNull val wickRatioThreshold: BigDecimal = BigDecimal("1.8"),
    @field:NotNull val closeRecoveryPercent: BigDecimal = BigDecimal("55"),
    @field:NotNull val minGapPercent: BigDecimal = BigDecimal("0.6"),
    @field:NotNull val minFillPercent: BigDecimal = BigDecimal("45"),
    @field:NotNull val maxConfirmationBars: Int = 12,
    @field:NotNull val stopLossPercent: BigDecimal = BigDecimal("8"),
    @field:NotNull val target1Percent: BigDecimal = BigDecimal("12"),
    @field:NotNull val target2Percent: BigDecimal = BigDecimal("20"),
    @field:NotEmpty val entryMode: String = "SIGNAL_CLOSE",
    @field:NotEmpty val exitMode: String = "TRAILING_STOP",
    val enabled: Boolean = true,
    val source: String = "preset",
)

data class BacktestSignalPlanRequest(
    @field:NotEmpty val buyMode: String,
    @field:NotEmpty val sellMode: String,
    @field:NotEmpty val holdMode: String,
    @field:NotNull val maxHoldingDays: Int,
    @field:NotNull val stopLossPercent: BigDecimal,
    @field:NotNull val takeProfitPercent: BigDecimal,
    @field:NotEmpty val rebalanceGuard: String,
)

data class StrategyWeightSnapshotCreateRequest(
    @field:NotNull val strategyId: Long,
    @field:NotEmpty val name: String,
    val factorWeightMode: String = "AUTO",
    val factorWeights: List<StrategyFactorWeightRequest> = emptyList(),
)

data class OptimizationRequest(
    @field:NotNull val strategyId: Long,
    @field:NotEmpty val parameter: String = "roe_filter",
    @field:NotNull val start: BigDecimal = BigDecimal("5"),
    @field:NotNull val end: BigDecimal = BigDecimal("25"),
    @field:NotNull val step: BigDecimal = BigDecimal("5"),
    @field:NotEmpty val objective: String = "sharpe",
    val startDate: LocalDate? = null,
    val endDate: LocalDate? = null,
    val benchmarkSymbol: String = "SPY",
)

data class StrategyCompareRequest(
    @field:NotEmpty val strategyIds: List<Long>,
    val startDate: LocalDate? = null,
    val endDate: LocalDate? = null,
    val benchmarkSymbol: String = "SPY",
)

data class StrategyRunRequest(
    @field:NotNull val strategyId: Long,
    @field:NotNull val portfolioId: Long,
)

data class OrderCreateRequest(
    @field:NotNull val portfolioId: Long,
    @field:NotNull val symbol: String,
    @field:NotNull val side: String,
    @field:NotNull val orderType: String,
    val price: BigDecimal?,
    @field:NotNull val quantity: BigDecimal,
)

data class PortfolioCreateRequest(
    @field:NotEmpty val name: String,
    @field:NotEmpty val baseCurrency: String,
)

data class PortfolioAssetCreateRequest(
    @field:NotNull val portfolioId: Long,
    @field:NotEmpty val symbol: String,
    @field:NotNull val quantity: BigDecimal,
    @field:NotNull val avgPrice: BigDecimal,
)

data class DataUpdateRequest(
    val preset: String? = null,
    val symbols: List<String> = emptyList(),
    val benchmarkSymbols: List<String> = emptyList(),
    val period: String? = null,
    val interval: String? = null,
)

data class StockRegisterRequest(
    @field:NotEmpty val symbol: String,
    val marketType: String? = null,
    val assetGroup: String? = null,
    val period: String? = null,
    val interval: String? = null,
)
