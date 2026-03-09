package com.gh.quant.platform.repository

import com.gh.quant.platform.domain.entity.Backtest
import com.gh.quant.platform.domain.entity.BacktestEquity
import com.gh.quant.platform.domain.entity.DataSource
import com.gh.quant.platform.domain.entity.Execution
import com.gh.quant.platform.domain.entity.Fundamental
import com.gh.quant.platform.domain.entity.FactorExposure
import com.gh.quant.platform.domain.entity.Job
import com.gh.quant.platform.domain.entity.News
import com.gh.quant.platform.domain.entity.NewsImpact
import com.gh.quant.platform.domain.entity.NewsSymbol
import com.gh.quant.platform.domain.entity.Event
import com.gh.quant.platform.domain.entity.EventAnalysis
import com.gh.quant.platform.domain.entity.Portfolio
import com.gh.quant.platform.domain.entity.PortfolioHistory
import com.gh.quant.platform.domain.entity.Position
import com.gh.quant.platform.domain.entity.Price
import com.gh.quant.platform.domain.entity.RiskMetric
import com.gh.quant.platform.domain.entity.Stock
import com.gh.quant.platform.domain.entity.Strategy
import com.gh.quant.platform.domain.entity.StrategyFactor
import com.gh.quant.platform.domain.entity.StrategyOptimizationRun
import com.gh.quant.platform.domain.entity.StrategyComparisonRun
import com.gh.quant.platform.domain.entity.StrategyWeightSnapshot
import com.gh.quant.platform.domain.entity.StrategyRun
import com.gh.quant.platform.domain.entity.TradingOrder
import com.gh.quant.platform.domain.entity.User
import com.gh.quant.platform.repository.custom.StockQueryRepository
import org.springframework.data.jpa.repository.JpaRepository

interface UserRepository : JpaRepository<User, Long> {
    fun findByEmail(email: String): User?
    fun findFirstByStatusOrderByIdAsc(status: String): User?
}

interface StockRepository : JpaRepository<Stock, Long>, StockQueryRepository {
    fun findBySymbol(symbol: String): Stock?
}

interface PriceRepository : JpaRepository<Price, Long> {
    fun findTop2BySymbolOrderByDateDesc(symbol: String): List<Price>
    fun findTop180BySymbolOrderByDateDesc(symbol: String): List<Price>
    fun countBySymbol(symbol: String): Long
}

interface FundamentalRepository : JpaRepository<Fundamental, Long> {
    fun findTop12BySymbolOrderByDateDesc(symbol: String): List<Fundamental>
    fun countBySymbol(symbol: String): Long
}

interface StrategyRepository : JpaRepository<Strategy, Long> {
    fun findByStatus(status: String): List<Strategy>
    fun findAllByOrderByCreatedAtDesc(): List<Strategy>
    fun findByStatusNotOrderByCreatedAtDesc(status: String): List<Strategy>
}

interface StrategyFactorRepository : JpaRepository<StrategyFactor, Long> {
    fun findByStrategyId(strategyId: Long): List<StrategyFactor>
    fun findByStrategyIdIn(strategyIds: Collection<Long>): List<StrategyFactor>
}

interface StrategyWeightSnapshotRepository : JpaRepository<StrategyWeightSnapshot, Long> {
    fun findByStrategyIdOrderByCreatedAtDesc(strategyId: Long): List<StrategyWeightSnapshot>
}

interface BacktestRepository : JpaRepository<Backtest, Long> {
    fun findTopByOrderByCreatedAtDesc(): Backtest?
    fun findTopByStrategyIdOrderByCreatedAtDesc(strategyId: Long): Backtest?
    fun findByStrategyIdIn(strategyIds: Collection<Long>): List<Backtest>
    fun findTop20ByOrderByCreatedAtDesc(): List<Backtest>
    fun findTop20ByStrategyIdOrderByCreatedAtDesc(strategyId: Long): List<Backtest>
}

interface BacktestEquityRepository : JpaRepository<BacktestEquity, Long> {
    fun findByBacktestIdOrderByDateAsc(backtestId: Long): List<BacktestEquity>
}

interface PortfolioRepository : JpaRepository<Portfolio, Long> {
    fun findAllByOrderByCreatedAtDesc(): List<Portfolio>
}

interface PositionRepository : JpaRepository<Position, Long> {
    fun findByPortfolioId(portfolioId: Long): List<Position>
    fun findByPortfolioIdIn(portfolioIds: Collection<Long>): List<Position>
    fun findByPortfolioIdAndSymbol(portfolioId: Long, symbol: String): Position?
}

interface PortfolioHistoryRepository : JpaRepository<PortfolioHistory, Long> {
    fun findTop2ByPortfolioIdOrderByDateDesc(portfolioId: Long): List<PortfolioHistory>
    fun findTopByPortfolioIdOrderByDateDesc(portfolioId: Long): PortfolioHistory?
}

interface TradingOrderRepository : JpaRepository<TradingOrder, Long> {
    fun findByPortfolioIdOrderBySubmittedAtDesc(portfolioId: Long): List<TradingOrder>
}

interface ExecutionRepository : JpaRepository<Execution, Long>

interface StrategyRunRepository : JpaRepository<StrategyRun, Long> {
    fun countByStatus(status: String): Long
    fun findByStatus(status: String): List<StrategyRun>
    fun findTop20ByOrderByCreatedAtDesc(): List<StrategyRun>
}

interface StrategyOptimizationRunRepository : JpaRepository<StrategyOptimizationRun, Long> {
    fun findTop20ByOrderByCreatedAtDesc(): List<StrategyOptimizationRun>
}

interface StrategyComparisonRunRepository : JpaRepository<StrategyComparisonRun, Long> {
    fun findTop20ByOrderByCreatedAtDesc(): List<StrategyComparisonRun>
}

interface RiskMetricRepository : JpaRepository<RiskMetric, Long> {
    fun findTopByPortfolioIdOrderByDateDesc(portfolioId: Long): RiskMetric?
}

interface FactorExposureRepository : JpaRepository<FactorExposure, Long>

interface JobRepository : JpaRepository<Job, Long> {
    fun findTop50ByOrderByCreatedAtDesc(): List<Job>
    fun findTop200ByJobTypeOrderByCreatedAtDesc(jobType: String): List<Job>
    fun findFirstByJobTypeAndStatusInOrderByCreatedAtDesc(jobType: String, statuses: Collection<String>): Job?
}

interface DataSourceRepository : JpaRepository<DataSource, Long>

interface NewsRepository : JpaRepository<News, Long> {
    fun countByPublishedAtAfter(publishedAt: java.time.OffsetDateTime): Long
    fun findTop50ByOrderByPublishedAtDesc(): List<News>
    fun findTop100ByOrderByPublishedAtDesc(): List<News>
}

interface NewsSymbolRepository : JpaRepository<NewsSymbol, Long> {
    @org.springframework.data.jpa.repository.Query(
        """
        select ns.symbol, count(ns.id), avg(n.sentimentScore)
        from NewsSymbol ns
        join ns.news n
        group by ns.symbol
        order by count(ns.id) desc
        """,
    )
    fun findImpactStocks(pageable: org.springframework.data.domain.Pageable): List<Array<Any?>>
}

interface NewsImpactRepository : JpaRepository<NewsImpact, Long> {
    fun findTop100BySymbolOrderByImpactScoreDescCreatedAtDesc(symbol: String): List<NewsImpact>
    @org.springframework.data.jpa.repository.Query(
        """
        select ni
        from NewsImpact ni
        join fetch ni.news n
        where upper(ni.symbol) = upper(:symbol)
        order by n.publishedAt desc, ni.impactScore desc
        """,
    )
    fun findRecentBySymbol(
        @org.springframework.data.repository.query.Param("symbol") symbol: String,
        pageable: org.springframework.data.domain.Pageable,
    ): List<NewsImpact>
    fun countBySymbol(symbol: String): Long
}

interface EventRepository : JpaRepository<Event, Long> {
    fun findTop50ByOrderByEventDateDesc(): List<Event>
    fun countBySymbol(symbol: String): Long
    fun findTop20BySymbolOrderByEventDateDesc(symbol: String): List<Event>
}

interface EventAnalysisRepository : JpaRepository<EventAnalysis, Long> {
    fun findByEvent_IdIn(eventIds: Collection<Long>): List<EventAnalysis>
}
