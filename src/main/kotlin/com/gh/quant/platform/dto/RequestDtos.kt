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
)

data class BacktestRequest(
    @field:NotNull val strategyId: Long,
    @field:NotNull val startDate: LocalDate,
    @field:NotNull val endDate: LocalDate,
    val snapshotId: Long? = null,
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
