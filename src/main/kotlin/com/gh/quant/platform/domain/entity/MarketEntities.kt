package com.gh.quant.platform.domain.entity

import com.gh.quant.platform.domain.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Table
import java.math.BigDecimal
import java.time.LocalDate

@Entity
@Table(name = "stocks")
class Stock(
    @Column(nullable = false, unique = true, length = 32)
    var symbol: String = "",
    @Column(nullable = false)
    var name: String = "",
    @Column(nullable = false, length = 50)
    var exchange: String = "",
    @Column(length = 100)
    var sector: String? = null,
    @Column(length = 150)
    var industry: String? = null,
    @Column(nullable = false, length = 16)
    var currency: String = "",
    @Column(name = "market_cap", precision = 24, scale = 4)
    var marketCap: BigDecimal? = null,
) : BaseEntity()

@Entity
@Table(name = "prices")
class Price(
    @Column(nullable = false, length = 32)
    var symbol: String = "",
    @Column(nullable = false)
    var date: LocalDate? = null,
    @Column(nullable = false, precision = 20, scale = 6)
    var open: BigDecimal? = null,
    @Column(nullable = false, precision = 20, scale = 6)
    var high: BigDecimal? = null,
    @Column(nullable = false, precision = 20, scale = 6)
    var low: BigDecimal? = null,
    @Column(nullable = false, precision = 20, scale = 6)
    var close: BigDecimal? = null,
    @Column(name = "adj_close", precision = 20, scale = 6)
    var adjClose: BigDecimal? = null,
    @Column(nullable = false)
    var volume: Long = 0,
) : BaseEntity()

@Entity
@Table(name = "fundamentals")
class Fundamental(
    @Column(nullable = false, length = 32)
    var symbol: String = "",
    @Column(nullable = false)
    var date: LocalDate? = null,
    @Column(precision = 20, scale = 6)
    var per: BigDecimal? = null,
    @Column(precision = 20, scale = 6)
    var pbr: BigDecimal? = null,
    @Column(precision = 20, scale = 6)
    var roe: BigDecimal? = null,
    @Column(precision = 20, scale = 6)
    var eps: BigDecimal? = null,
    @Column(name = "dividend_yield", precision = 20, scale = 6)
    var dividendYield: BigDecimal? = null,
    @Column(name = "market_cap", precision = 24, scale = 4)
    var marketCap: BigDecimal? = null,
    @Column(precision = 24, scale = 4)
    var revenue: BigDecimal? = null,
    @Column(name = "net_income", precision = 24, scale = 4)
    var netIncome: BigDecimal? = null,
) : BaseEntity()

@Entity
@Table(name = "factor_data")
class FactorData(
    @Column(nullable = false, length = 32)
    var symbol: String = "",
    @Column(nullable = false)
    var date: LocalDate? = null,
    @Column(precision = 20, scale = 6)
    var momentum: BigDecimal? = null,
    @Column(precision = 20, scale = 6)
    var volatility: BigDecimal? = null,
    @Column(name = "value_score", precision = 20, scale = 6)
    var valueScore: BigDecimal? = null,
    @Column(name = "quality_score", precision = 20, scale = 6)
    var qualityScore: BigDecimal? = null,
    @Column(name = "growth_score", precision = 20, scale = 6)
    var growthScore: BigDecimal? = null,
) : BaseEntity()

@Entity
@Table(name = "market_indices")
class MarketIndex(
    @Column(nullable = false, unique = true, length = 32)
    var symbol: String = "",
    @Column(nullable = false)
    var name: String = "",
    @Column(name = "last_price", precision = 20, scale = 6)
    var lastPrice: BigDecimal? = null,
    @Column(name = "change_percent", precision = 20, scale = 6)
    var changePercent: BigDecimal? = null,
) : BaseEntity()

@Entity
@Table(name = "benchmark_data")
class BenchmarkData(
    @Column(nullable = false, length = 32)
    var symbol: String = "",
    @Column(nullable = false)
    var date: LocalDate? = null,
    @Column(nullable = false, precision = 20, scale = 6)
    var price: BigDecimal? = null,
) : BaseEntity()
