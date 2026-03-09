package com.gh.quant.platform.domain.entity

import com.gh.quant.platform.domain.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.math.BigDecimal
import java.time.OffsetDateTime

@Entity
@Table(name = "news")
class News(
    @Column(nullable = false, length = 500)
    var title: String = "",
    @Column(columnDefinition = "TEXT")
    var content: String? = null,
    @Column(nullable = false)
    var source: String = "",
    @Column(nullable = false, length = 1000)
    var url: String = "",
    @Column(name = "published_at", nullable = false)
    var publishedAt: OffsetDateTime? = null,
    @Column(name = "sentiment_score", precision = 20, scale = 6)
    var sentimentScore: BigDecimal? = null,
) : BaseEntity()

@Entity
@Table(name = "news_symbols")
class NewsSymbol(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "news_id", nullable = false)
    var news: News? = null,
    @Column(nullable = false, length = 32)
    var symbol: String = "",
    @Column(name = "relevance_score", precision = 12, scale = 6)
    var relevanceScore: BigDecimal? = null,
) : BaseEntity()

@Entity
@Table(name = "news_impact")
class NewsImpact(
    @Column(nullable = false, length = 32)
    var symbol: String = "",
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "news_id", nullable = false)
    var news: News? = null,
    @Column(name = "impact_score", nullable = false, precision = 12, scale = 6)
    var impactScore: BigDecimal = BigDecimal.ZERO,
    @Column(nullable = false, precision = 12, scale = 6)
    var distance: BigDecimal = BigDecimal.ZERO,
    @Column(name = "node_color", nullable = false, length = 32)
    var nodeColor: String = "gray",
) : BaseEntity()

@Entity
@Table(name = "events")
class Event(
    @Column(nullable = false, length = 32)
    var symbol: String = "",
    @Column(name = "event_type", nullable = false, length = 100)
    var eventType: String = "",
    @Column(name = "event_date", nullable = false)
    var eventDate: OffsetDateTime? = null,
    @Column(columnDefinition = "TEXT")
    var description: String? = null,
) : BaseEntity()

@Entity
@Table(name = "event_analysis")
class EventAnalysis(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    var event: Event? = null,
    @Column(name = "price_t1", precision = 20, scale = 6)
    var priceT1: BigDecimal? = null,
    @Column(name = "price_t5", precision = 20, scale = 6)
    var priceT5: BigDecimal? = null,
    @Column(name = "price_t20", precision = 20, scale = 6)
    var priceT20: BigDecimal? = null,
) : BaseEntity()
