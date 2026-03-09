package com.gh.quant.platform.controller

import com.gh.quant.platform.domain.entity.StrategyRun
import com.gh.quant.platform.dto.ApiResponse
import com.gh.quant.platform.dto.PortfolioAssetCreateRequest
import com.gh.quant.platform.dto.BacktestRequest
import com.gh.quant.platform.dto.OrderCreateRequest
import com.gh.quant.platform.dto.OptimizationRequest
import com.gh.quant.platform.dto.PortfolioCreateRequest
import com.gh.quant.platform.dto.DataUpdateRequest
import com.gh.quant.platform.dto.StrategyCompareRequest
import com.gh.quant.platform.dto.StrategyCreateRequest
import com.gh.quant.platform.dto.StrategyUpdateRequest
import com.gh.quant.platform.dto.StockRegisterRequest
import com.gh.quant.platform.dto.StrategyRunRequest
import com.gh.quant.platform.dto.StrategyWeightSnapshotCreateRequest
import com.gh.quant.platform.service.BacktestService
import com.gh.quant.platform.service.DashboardService
import com.gh.quant.platform.service.DataCenterService
import com.gh.quant.platform.service.JobService
import com.gh.quant.platform.service.MarketService
import com.gh.quant.platform.service.NewsIntelligenceService
import com.gh.quant.platform.service.OrderService
import com.gh.quant.platform.service.PortfolioService
import com.gh.quant.platform.service.RiskService
import com.gh.quant.platform.service.ScreenerService
import com.gh.quant.platform.service.StockLookupService
import com.gh.quant.platform.service.StockDataExplorerService
import com.gh.quant.platform.service.StrategyService
import com.gh.quant.platform.service.EventAnalysisService
import com.gh.quant.platform.service.AlternativeDataCenterService
import jakarta.validation.Valid
import java.math.BigDecimal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class DashboardController(private val dashboardService: DashboardService) {
    @GetMapping("/dashboard")
    fun getDashboard(@RequestParam(defaultValue = "1") portfolioId: Long) = ApiResponse.ok(dashboardService.getDashboardSummary(portfolioId))
}

@RestController
@RequestMapping("/api/market")
class MarketController(private val marketService: MarketService) {
    @GetMapping("/indices")
    fun getIndices() = ApiResponse.ok(marketService.getIndices())

    @GetMapping("/sectors")
    fun getSectors() = ApiResponse.ok(marketService.getSectors())
}

@RestController
@RequestMapping("/api")
class StrategyController(private val strategyService: StrategyService) {
    @GetMapping("/strategy")
    fun listStrategies() = ApiResponse.ok(strategyService.getStrategies())

    @PostMapping("/strategy")
    fun createStrategy(@Valid @RequestBody request: StrategyCreateRequest) = ApiResponse.ok(strategyService.createStrategy(request))

    @PutMapping("/strategy/{id}")
    fun updateStrategy(@PathVariable id: Long, @Valid @RequestBody request: StrategyUpdateRequest) =
        ApiResponse.ok(strategyService.updateStrategy(id, request))

    @DeleteMapping("/strategy/{id}")
    fun deleteStrategy(@PathVariable id: Long) = ApiResponse.ok(strategyService.deleteStrategy(id))

    @GetMapping("/strategy/{id}/diagnostics")
    fun diagnostics(@PathVariable id: Long) = ApiResponse.ok(strategyService.getStrategyDiagnostics(id))

    @GetMapping("/strategy/{id}/snapshots")
    fun snapshots(@PathVariable id: Long) = ApiResponse.ok(strategyService.getWeightSnapshots(id))

    @PostMapping("/strategy/snapshot")
    fun createSnapshot(@Valid @RequestBody request: StrategyWeightSnapshotCreateRequest) = ApiResponse.ok(strategyService.createWeightSnapshot(request))

    @PostMapping("/strategy/optimize")
    fun optimize(@Valid @RequestBody request: OptimizationRequest) = ApiResponse.ok(strategyService.optimize(request))

    @GetMapping("/strategy/optimize/history")
    fun optimizeHistory() = ApiResponse.ok(strategyService.getOptimizationHistory())

    @PostMapping("/strategy/compare")
    fun compare(@Valid @RequestBody request: StrategyCompareRequest) = ApiResponse.ok(strategyService.compare(request))

    @GetMapping("/strategy/compare/history")
    fun compareHistory() = ApiResponse.ok(strategyService.getComparisonHistory())

    @PostMapping("/strategy/start")
    fun start(@Valid @RequestBody request: StrategyRunRequest): ApiResponse<StrategyRun> = ApiResponse.ok(strategyService.startStrategy(request))

    @PostMapping("/strategy/stop")
    fun stop(@RequestParam strategyRunId: Long): ApiResponse<StrategyRun> = ApiResponse.ok(strategyService.stopStrategy(strategyRunId))

    @GetMapping("/strategy/runs")
    fun runs() = ApiResponse.ok(strategyService.getStrategyRuns())
}

@RestController
@RequestMapping("/api")
class BacktestController(private val backtestService: BacktestService) {
    @PostMapping("/backtest")
    fun backtest(@Valid @RequestBody request: BacktestRequest) = ApiResponse.ok(backtestService.runBacktest(request))

    @GetMapping("/backtest/job/{jobId}")
    fun backtestJob(@PathVariable jobId: Long) = ApiResponse.ok(backtestService.getBacktestJobStatus(jobId))

    @GetMapping("/backtest/history")
    fun backtestHistory(@RequestParam(required = false) strategyId: Long?) = ApiResponse.ok(backtestService.getBacktestHistory(strategyId))

    @GetMapping("/backtest/{id}")
    fun backtestDetail(@PathVariable id: Long) = ApiResponse.ok(backtestService.getBacktestDetail(id))
}

@RestController
@RequestMapping("/api")
class ScreenerController(private val screenerService: ScreenerService) {
    @GetMapping("/screener")
    fun screener(
        @RequestParam(name = "per_lt", required = false) perLt: BigDecimal?,
        @RequestParam(name = "roe_gt", required = false) roeGt: BigDecimal?,
        @RequestParam(name = "pbr_lt", required = false) pbrLt: BigDecimal?,
    ) = ApiResponse.ok(screenerService.search(perLt, roeGt, pbrLt))
}

@RestController
@RequestMapping("/api/stocks")
class StockLookupController(private val stockLookupService: StockLookupService) {
    @GetMapping("/search")
    fun search(
        @RequestParam q: String,
        @RequestParam(required = false) marketType: String?,
        @RequestParam(required = false) assetGroup: String?,
        @RequestParam(defaultValue = "20") limit: Int,
    ) = ApiResponse.ok(stockLookupService.search(q, marketType, assetGroup, limit))

    @PostMapping("/register")
    fun register(@Valid @RequestBody request: StockRegisterRequest) = ApiResponse.ok(stockLookupService.registerSymbol(request))
}

@RestController
@RequestMapping("/api/stocks")
class StockDataExplorerController(private val stockDataExplorerService: StockDataExplorerService) {
    @GetMapping("/{symbol}/data")
    fun detail(@PathVariable symbol: String) = ApiResponse.ok(stockDataExplorerService.getSymbolDetail(symbol))
}

@RestController
@RequestMapping("/api")
class PortfolioController(private val portfolioService: PortfolioService) {
    @GetMapping("/portfolio")
    fun getPortfolio(@RequestParam(required = false) portfolioId: Long?) =
        if (portfolioId != null) {
            ApiResponse.ok(portfolioService.getPortfolio(portfolioId))
        } else {
            ApiResponse.ok(portfolioService.listPortfolios())
        }

    @GetMapping("/portfolio/{id}")
    fun getPortfolioDetail(@PathVariable id: Long) = ApiResponse.ok(portfolioService.getPortfolioDetail(id))

    @PostMapping("/portfolio")
    fun createPortfolio(@Valid @RequestBody request: PortfolioCreateRequest) = ApiResponse.ok(portfolioService.createPortfolio(request))

    @PostMapping("/portfolio/asset")
    fun registerAsset(@Valid @RequestBody request: PortfolioAssetCreateRequest) = ApiResponse.ok(portfolioService.registerAsset(request))

    @DeleteMapping("/portfolio/asset/{id}")
    fun deleteAsset(@PathVariable id: Long) = ApiResponse.ok(portfolioService.deleteAsset(id))
}

@RestController
@RequestMapping("/api")
class OrderController(private val orderService: OrderService) {
    @GetMapping("/orders")
    fun getOrders(@RequestParam(defaultValue = "1") portfolioId: Long) = ApiResponse.ok(orderService.getOrders(portfolioId))

    @PostMapping("/order")
    fun createOrder(@Valid @RequestBody request: OrderCreateRequest) = ApiResponse.ok(orderService.createOrder(request))

    @PostMapping("/order/cancel")
    fun cancel(@RequestParam orderId: Long) = ApiResponse.ok(orderService.cancelOrder(orderId))
}

@RestController
@RequestMapping("/api/data")
class DataCenterController(private val dataCenterService: DataCenterService) {
    @PostMapping("/update")
    fun update(@RequestBody(required = false) request: DataUpdateRequest?) = ApiResponse.ok(dataCenterService.triggerUpdate(request))

    @GetMapping("/status")
    fun status() = ApiResponse.ok(dataCenterService.getStatus())
}

@RestController
@RequestMapping("/api")
class RiskController(private val riskService: RiskService) {
    @GetMapping("/risk")
    fun risk(@RequestParam(defaultValue = "1") portfolioId: Long) = ApiResponse.ok(riskService.getRisk(portfolioId))
}

@RestController
@RequestMapping("/api")
class JobController(private val jobService: JobService) {
    @GetMapping("/jobs")
    fun jobs() = ApiResponse.ok(jobService.getJobs())
}

@RestController
@RequestMapping("/api/news-intelligence")
class NewsIntelligenceController(private val newsIntelligenceService: NewsIntelligenceService) {
    @GetMapping("/summary")
    fun summary(@RequestParam(required = false) symbol: String?) = ApiResponse.ok(newsIntelligenceService.getSummary(symbol))
}

@RestController
@RequestMapping("/api/news")
class NewsImpactController(private val newsIntelligenceService: NewsIntelligenceService) {
    @GetMapping("/impact/{symbol}")
    fun impact(@PathVariable symbol: String) = ApiResponse.ok(newsIntelligenceService.getImpactGraph(symbol))
}

@RestController
@RequestMapping("/api/event-analysis")
class EventAnalysisController(private val eventAnalysisService: EventAnalysisService) {
    @GetMapping("/summary")
    fun summary(@RequestParam(required = false) symbol: String?) = ApiResponse.ok(eventAnalysisService.getSummary(symbol))
}

@RestController
@RequestMapping("/api/alternative-data-center")
class AlternativeDataCenterController(private val alternativeDataCenterService: AlternativeDataCenterService) {
    @GetMapping("/summary")
    fun summary() = ApiResponse.ok(alternativeDataCenterService.getSummary())
}
