package com.gh.quant.platform.domain.entity

import com.gh.quant.platform.domain.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.math.BigDecimal
import java.time.LocalDate
import java.time.OffsetDateTime
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes

@Entity
@Table(name = "strategies")
class Strategy(
    @Column(nullable = false)
    var name: String = "",
    @Column(columnDefinition = "TEXT")
    var description: String? = null,
    @Column(name = "roe_filter", precision = 20, scale = 6)
    var roeFilter: BigDecimal? = null,
    @Column(name = "pbr_filter", precision = 20, scale = 6)
    var pbrFilter: BigDecimal? = null,
    @Column(name = "momentum_filter", precision = 20, scale = 6)
    var momentumFilter: BigDecimal? = null,
    @Column(name = "stock_count")
    var stockCount: Int? = null,
    @Column(name = "rebalance_period", length = 50)
    var rebalancePeriod: String? = null,
    @Column(name = "weighting_method", length = 50)
    var weightingMethod: String? = null,
    @Column(name = "factor_weight_mode", nullable = false, length = 20)
    var factorWeightMode: String = "AUTO",
    @Column(nullable = false, length = 50)
    var status: String = "DRAFT",
) : BaseEntity()

@Entity
@Table(name = "strategy_factors")
class StrategyFactor(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "strategy_id", nullable = false)
    var strategy: Strategy? = null,
    @Column(name = "factor_name", nullable = false, length = 100)
    var factorName: String = "",
    @Column(name = "factor_weight", nullable = false, precision = 12, scale = 6)
    var factorWeight: BigDecimal? = null,
) : BaseEntity()

@Entity
@Table(name = "strategy_weight_snapshots")
class StrategyWeightSnapshot(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "strategy_id", nullable = false)
    var strategy: Strategy? = null,
    @Column(nullable = false, length = 255)
    var name: String = "",
    @Column(name = "factor_weight_mode", nullable = false, length = 20)
    var factorWeightMode: String = "AUTO",
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "factor_weights_json", nullable = false, columnDefinition = "jsonb")
    var factorWeightsJson: String = "{}",
) : BaseEntity()

@Entity
@Table(name = "backtests")
class Backtest(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "strategy_id", nullable = false)
    var strategy: Strategy? = null,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "snapshot_id")
    var snapshot: StrategyWeightSnapshot? = null,
    @Column(name = "start_date", nullable = false)
    var startDate: LocalDate? = null,
    @Column(name = "end_date", nullable = false)
    var endDate: LocalDate? = null,
    @Column(precision = 20, scale = 6)
    var cagr: BigDecimal? = null,
    @Column(precision = 20, scale = 6)
    var sharpe: BigDecimal? = null,
    @Column(name = "max_drawdown", precision = 20, scale = 6)
    var maxDrawdown: BigDecimal? = null,
    @Column(precision = 20, scale = 6)
    var volatility: BigDecimal? = null,
    @Column(name = "win_rate", precision = 20, scale = 6)
    var winRate: BigDecimal? = null,
) : BaseEntity()

@Entity
@Table(name = "backtest_equity")
class BacktestEquity(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "backtest_id", nullable = false)
    var backtest: Backtest? = null,
    @Column(nullable = false)
    var date: LocalDate? = null,
    @Column(name = "equity_value", nullable = false, precision = 24, scale = 6)
    var equityValue: BigDecimal? = null,
) : BaseEntity()

@Entity
@Table(name = "strategy_runs")
class StrategyRun(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "strategy_id", nullable = false)
    var strategy: Strategy? = null,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "portfolio_id", nullable = false)
    var portfolio: Portfolio? = null,
    @Column(nullable = false, length = 50)
    var status: String = "PENDING",
    @Column(name = "started_at")
    var startedAt: OffsetDateTime? = null,
    @Column(name = "finished_at")
    var finishedAt: OffsetDateTime? = null,
) : BaseEntity()

@Entity
@Table(name = "strategy_allocations")
class StrategyAllocation(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "strategy_run_id", nullable = false)
    var strategyRun: StrategyRun? = null,
    @Column(nullable = false, length = 32)
    var symbol: String = "",
    @Column(nullable = false, precision = 12, scale = 6)
    var weight: BigDecimal? = null,
) : BaseEntity()

@Entity
@Table(name = "strategy_optimization_runs")
class StrategyOptimizationRun(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "strategy_id", nullable = false)
    var strategy: Strategy? = null,
    @Column(name = "parameter_name", nullable = false, length = 100)
    var parameterName: String = "",
    @Column(name = "start_value", nullable = false, precision = 20, scale = 6)
    var startValue: BigDecimal = BigDecimal.ZERO,
    @Column(name = "end_value", nullable = false, precision = 20, scale = 6)
    var endValue: BigDecimal = BigDecimal.ZERO,
    @Column(name = "step_value", nullable = false, precision = 20, scale = 6)
    var stepValue: BigDecimal = BigDecimal.ZERO,
    @Column(nullable = false, length = 100)
    var objective: String = "",
    @Column(name = "benchmark_symbol", length = 32)
    var benchmarkSymbol: String? = null,
    @Column(name = "start_date")
    var startDate: LocalDate? = null,
    @Column(name = "end_date")
    var endDate: LocalDate? = null,
    @Column(nullable = false, length = 50)
    var status: String = "COMPLETED",
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "best_parameters_json", columnDefinition = "jsonb")
    var bestParametersJson: String? = null,
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result_json", columnDefinition = "jsonb")
    var resultJson: String? = null,
) : BaseEntity()

@Entity
@Table(name = "strategy_comparison_runs")
class StrategyComparisonRun(
    @Column(name = "benchmark_symbol", nullable = false, length = 32)
    var benchmarkSymbol: String = "SPY",
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "strategy_ids_json", nullable = false, columnDefinition = "jsonb")
    var strategyIdsJson: String = "[]",
    @Column(name = "start_date")
    var startDate: LocalDate? = null,
    @Column(name = "end_date")
    var endDate: LocalDate? = null,
    @Column(nullable = false, length = 50)
    var status: String = "COMPLETED",
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result_json", columnDefinition = "jsonb")
    var resultJson: String? = null,
) : BaseEntity()
