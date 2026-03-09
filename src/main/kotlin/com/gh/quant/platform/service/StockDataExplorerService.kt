package com.gh.quant.platform.service

import com.gh.quant.platform.dto.StockDataDetailDto
import com.gh.quant.platform.dto.StockDataEventItemDto
import com.gh.quant.platform.dto.StockDataFundamentalPointDto
import com.gh.quant.platform.dto.StockDataNewsItemDto
import com.gh.quant.platform.dto.StockDataPricePointDto
import com.gh.quant.platform.exception.ResourceNotFoundException
import com.gh.quant.platform.repository.EventAnalysisRepository
import com.gh.quant.platform.repository.EventRepository
import com.gh.quant.platform.repository.FundamentalRepository
import com.gh.quant.platform.repository.NewsImpactRepository
import com.gh.quant.platform.repository.PriceRepository
import com.gh.quant.platform.repository.StockRepository
import java.math.BigDecimal
import java.math.RoundingMode
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class StockDataExplorerService(
    private val stockRepository: StockRepository,
    private val priceRepository: PriceRepository,
    private val fundamentalRepository: FundamentalRepository,
    private val newsImpactRepository: NewsImpactRepository,
    private val eventRepository: EventRepository,
    private val eventAnalysisRepository: EventAnalysisRepository,
) {
    @Transactional(readOnly = true)
    fun getSymbolDetail(symbol: String): StockDataDetailDto {
        val resolvedSymbol = symbol.trim().uppercase()
        val stock = stockRepository.findBySymbol(resolvedSymbol)
            ?: throw ResourceNotFoundException("저장된 종목 데이터를 찾을 수 없습니다: $resolvedSymbol")

        val latestPrices = priceRepository.findTop2BySymbolOrderByDateDesc(resolvedSymbol)
        val priceSeries = priceRepository.findTop180BySymbolOrderByDateDesc(resolvedSymbol).reversed()
        val fundamentals = fundamentalRepository.findTop12BySymbolOrderByDateDesc(resolvedSymbol)
        val newsImpacts = newsImpactRepository.findRecentBySymbol(resolvedSymbol, PageRequest.of(0, 20))
        val events = eventRepository.findTop20BySymbolOrderByEventDateDesc(resolvedSymbol)
        val eventAnalyses = if (events.isNotEmpty()) {
            eventAnalysisRepository.findByEvent_IdIn(events.mapNotNull { it.id })
        } else {
            emptyList()
        }
        val analysisByEventId = eventAnalyses
            .mapNotNull { analysis -> (analysis.event?.id)?.let { it to analysis } }
            .groupBy({ it.first }, { it.second })
            .mapValues { (_, items) ->
                items.maxByOrNull { analysis ->
                    analysis.createdAt?.toEpochSecond() ?: Long.MIN_VALUE
                }
            }

        val latestPrice = latestPrices.getOrNull(0)
        val previousPrice = latestPrices.getOrNull(1)
        val latestClose = latestPrice?.adjClose ?: latestPrice?.close
        val previousClose = previousPrice?.adjClose ?: previousPrice?.close
        val changePercent = if (latestClose != null && previousClose != null && previousClose.compareTo(BigDecimal.ZERO) != 0) {
            latestClose
                .subtract(previousClose)
                .divide(previousClose, 6, RoundingMode.HALF_UP)
                .multiply(BigDecimal("100"))
                .setScale(2, RoundingMode.HALF_UP)
        } else {
            null
        }

        return StockDataDetailDto(
            symbol = stock.symbol,
            name = stock.name,
            exchange = stock.exchange,
            currency = stock.currency,
            sector = stock.sector,
            industry = stock.industry,
            marketCap = stock.marketCap ?: fundamentals.firstOrNull()?.marketCap,
            latestPriceDate = latestPrice?.date?.toString(),
            latestPrice = latestClose,
            previousClose = previousClose,
            changePercent = changePercent,
            priceRowCount = priceRepository.countBySymbol(resolvedSymbol),
            fundamentalsRowCount = fundamentalRepository.countBySymbol(resolvedSymbol),
            newsCount = newsImpactRepository.countBySymbol(resolvedSymbol),
            eventCount = eventRepository.countBySymbol(resolvedSymbol),
            priceSeries = priceSeries.mapNotNull { price ->
                val date = price.date ?: return@mapNotNull null
                StockDataPricePointDto(
                    date = date,
                    open = price.open,
                    high = price.high,
                    low = price.low,
                    close = price.close,
                    adjClose = price.adjClose,
                    volume = price.volume,
                )
            },
            fundamentals = fundamentals.mapNotNull { fundamental ->
                val date = fundamental.date ?: return@mapNotNull null
                StockDataFundamentalPointDto(
                    date = date,
                    per = fundamental.per,
                    pbr = fundamental.pbr,
                    roe = fundamental.roe,
                    eps = fundamental.eps,
                    dividendYield = fundamental.dividendYield,
                    marketCap = fundamental.marketCap,
                    revenue = fundamental.revenue,
                    netIncome = fundamental.netIncome,
                )
            },
            news = newsImpacts.mapNotNull { impact ->
                val news = impact.news ?: return@mapNotNull null
                StockDataNewsItemDto(
                    title = news.title,
                    source = news.source,
                    publishedAt = news.publishedAt?.toString(),
                    sentimentScore = news.sentimentScore,
                    impactScore = impact.impactScore,
                    url = news.url,
                )
            },
            events = events.map { event ->
                val analysis = event.id?.let { analysisByEventId[it] }
                StockDataEventItemDto(
                    eventType = event.eventType,
                    eventDate = event.eventDate?.toString(),
                    description = event.description,
                    priceT1 = analysis?.priceT1,
                    priceT5 = analysis?.priceT5,
                    priceT20 = analysis?.priceT20,
                )
            },
        )
    }
}
