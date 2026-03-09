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

@Entity
@Table(name = "portfolio")
class Portfolio(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    var user: User? = null,
    @Column(nullable = false)
    var name: String = "",
    @Column(name = "base_currency", nullable = false, length = 16)
    var baseCurrency: String = "KRW",
    @Column(nullable = false, length = 50)
    var status: String = "ACTIVE",
) : BaseEntity()

@Entity
@Table(name = "positions")
class Position(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "portfolio_id", nullable = false)
    var portfolio: Portfolio? = null,
    @Column(nullable = false, length = 32)
    var symbol: String = "",
    @Column(nullable = false, precision = 24, scale = 6)
    var quantity: BigDecimal? = null,
    @Column(name = "avg_price", nullable = false, precision = 20, scale = 6)
    var avgPrice: BigDecimal? = null,
    @Column(name = "current_price", precision = 20, scale = 6)
    var currentPrice: BigDecimal? = null,
    @Column(name = "market_value", precision = 24, scale = 6)
    var marketValue: BigDecimal? = null,
    @Column(name = "unrealized_pnl", precision = 24, scale = 6)
    var unrealizedPnl: BigDecimal? = null,
) : BaseEntity()

@Entity
@Table(name = "portfolio_history")
class PortfolioHistory(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "portfolio_id", nullable = false)
    var portfolio: Portfolio? = null,
    @Column(nullable = false)
    var date: LocalDate? = null,
    @Column(name = "portfolio_value", nullable = false, precision = 24, scale = 6)
    var portfolioValue: BigDecimal? = null,
    @Column(name = "daily_return", precision = 20, scale = 6)
    var dailyReturn: BigDecimal? = null,
) : BaseEntity()

@Entity
@Table(name = "orders")
class TradingOrder(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "portfolio_id", nullable = false)
    var portfolio: Portfolio? = null,
    @Column(nullable = false, length = 32)
    var symbol: String = "",
    @Column(nullable = false, length = 20)
    var side: String = "BUY",
    @Column(name = "order_type", nullable = false, length = 30)
    var orderType: String = "LIMIT",
    @Column(precision = 20, scale = 6)
    var price: BigDecimal? = null,
    @Column(nullable = false, precision = 24, scale = 6)
    var quantity: BigDecimal? = null,
    @Column(nullable = false, length = 30)
    var status: String = "PENDING",
    @Column(name = "submitted_at", nullable = false)
    var submittedAt: OffsetDateTime? = null,
) : BaseEntity()

@Entity
@Table(name = "executions")
class Execution(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    var order: TradingOrder? = null,
    @Column(nullable = false, precision = 20, scale = 6)
    var price: BigDecimal? = null,
    @Column(nullable = false, precision = 24, scale = 6)
    var quantity: BigDecimal? = null,
    @Column(name = "execution_time", nullable = false)
    var executionTime: OffsetDateTime? = null,
) : BaseEntity()

@Entity
@Table(name = "risk_metrics")
class RiskMetric(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "portfolio_id", nullable = false)
    var portfolio: Portfolio? = null,
    @Column(nullable = false)
    var date: LocalDate? = null,
    @Column(name = "var", precision = 20, scale = 6)
    var valueAtRisk: BigDecimal? = null,
    @Column(precision = 20, scale = 6)
    var beta: BigDecimal? = null,
    @Column(precision = 20, scale = 6)
    var volatility: BigDecimal? = null,
    @Column(name = "max_drawdown", precision = 20, scale = 6)
    var maxDrawdown: BigDecimal? = null,
) : BaseEntity()

@Entity
@Table(name = "factor_exposure")
class FactorExposure(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "portfolio_id", nullable = false)
    var portfolio: Portfolio? = null,
    @Column(nullable = false)
    var date: LocalDate? = null,
    @Column(name = "value_exposure", precision = 20, scale = 6)
    var valueExposure: BigDecimal? = null,
    @Column(name = "momentum_exposure", precision = 20, scale = 6)
    var momentumExposure: BigDecimal? = null,
    @Column(name = "quality_exposure", precision = 20, scale = 6)
    var qualityExposure: BigDecimal? = null,
    @Column(name = "growth_exposure", precision = 20, scale = 6)
    var growthExposure: BigDecimal? = null,
) : BaseEntity()
