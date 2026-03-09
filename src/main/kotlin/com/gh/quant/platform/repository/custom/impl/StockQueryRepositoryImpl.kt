package com.gh.quant.platform.repository.custom.impl

import com.gh.quant.platform.domain.entity.QFundamental.fundamental
import com.gh.quant.platform.domain.entity.QStock.stock
import com.gh.quant.platform.dto.ScreenerStockDto
import com.gh.quant.platform.dto.StockLookupDto
import com.gh.quant.platform.repository.custom.StockQueryRepository
import com.querydsl.core.BooleanBuilder
import com.querydsl.core.types.Projections
import com.querydsl.jpa.impl.JPAQueryFactory
import java.math.BigDecimal
import org.springframework.stereotype.Repository

@Repository
class StockQueryRepositoryImpl(
    private val queryFactory: JPAQueryFactory,
) : StockQueryRepository {
    private val etfNameTokens = listOf(
        "etf", "etn", "fund", "trust", "spdr", "ishares", "vanguard", "invesco", "wisdomtree",
        "proshares", "direxion", "global x", "first trust", "schwab", "ark", "kodex", "tiger",
        "arirang", "kbstar", "ace", "sol",
    )

    override fun searchByFactors(perLt: BigDecimal?, roeGt: BigDecimal?, pbrLt: BigDecimal?): List<ScreenerStockDto> {
        val predicate = BooleanBuilder()
        if (perLt != null) predicate.and(fundamental.per.loe(perLt))
        if (roeGt != null) predicate.and(fundamental.roe.goe(roeGt))
        if (pbrLt != null) predicate.and(fundamental.pbr.loe(pbrLt))

        return queryFactory
            .select(
                Projections.constructor(
                    ScreenerStockDto::class.java,
                    stock.symbol,
                    stock.name,
                    fundamental.per,
                    fundamental.roe,
                    stock.marketCap,
                ),
            )
            .from(stock)
            .join(fundamental).on(stock.symbol.eq(fundamental.symbol))
            .where(predicate)
            .orderBy(stock.marketCap.desc().nullsLast())
            .limit(100)
            .fetch()
    }

    override fun searchStocks(query: String, marketType: String?, assetGroup: String?, limit: Int): List<StockLookupDto> {
        val normalizedQuery = query.trim()
        if (normalizedQuery.isEmpty()) {
            return emptyList()
        }

        val predicate = BooleanBuilder()
            .and(
                stock.symbol.containsIgnoreCase(normalizedQuery)
                    .or(stock.name.containsIgnoreCase(normalizedQuery)),
            )

        marketType?.takeIf { it.isNotBlank() }?.let {
            when (it) {
                "DOMESTIC" -> predicate.and(stock.exchange.lower().`in`("kospi", "kosdaq", "krx", "xkrx", "kse", "ksq"))
                "INTERNATIONAL" -> predicate.and(stock.exchange.lower().notIn("kospi", "kosdaq", "krx", "xkrx", "kse", "ksq"))
                else -> Unit
            }
        }

        assetGroup?.takeIf { it.isNotBlank() }?.let {
            when (it) {
                "KOSPI" -> predicate.and(stock.exchange.lower().`in`("kospi", "krx", "xkrx", "kse"))
                    .and(stock.name.lower().notLike("%etf%"))
                "KOSDAQ" -> predicate.and(stock.exchange.lower().`in`("kosdaq", "ksq"))
                    .and(stock.name.lower().notLike("%etf%"))
                "ETF" -> predicate.and(buildEtfPredicate())
                "STOCK" -> predicate.and(buildEtfPredicate().not())
                else -> Unit
            }
        }

        return queryFactory
            .select(stock.symbol, stock.name, stock.exchange, stock.currency, stock.marketCap)
            .from(stock)
            .where(predicate)
            .orderBy(stock.marketCap.desc().nullsLast(), stock.symbol.asc())
            .limit(limit.toLong())
            .fetch()
            .map { tuple ->
                val symbol = tuple.get(stock.symbol) ?: ""
                val name = tuple.get(stock.name) ?: symbol
                val exchange = tuple.get(stock.exchange) ?: "UNKNOWN"
                val currency = tuple.get(stock.currency) ?: "USD"
                val resolvedMarketType = resolveMarketType(exchange)
                StockLookupDto(
                    symbol = symbol,
                    name = name,
                    exchange = exchange,
                    marketType = resolvedMarketType,
                    assetGroup = resolveAssetGroup(exchange, name, resolvedMarketType),
                    currency = currency,
                    marketCap = tuple.get(stock.marketCap),
                )
            }
    }

    private fun resolveMarketType(exchange: String): String =
        if (exchange.lowercase() in setOf("kospi", "kosdaq", "krx", "xkrx", "kse", "ksq")) "DOMESTIC" else "INTERNATIONAL"

    private fun resolveAssetGroup(exchange: String, name: String, marketType: String): String {
        val normalizedName = name.lowercase()
        val isEtf = etfNameTokens.any { token -> normalizedName.contains(token) }
        if (isEtf) {
            return "ETF"
        }
        return if (marketType == "DOMESTIC" && exchange.lowercase() in setOf("kosdaq", "ksq")) "KOSDAQ" else if (marketType == "DOMESTIC") "KOSPI" else "STOCK"
    }

    private fun buildEtfPredicate(): BooleanBuilder {
        val predicate = BooleanBuilder()
        etfNameTokens.forEachIndexed { index, token ->
            val condition = stock.name.lower().like("%${token.lowercase()}%")
            if (index == 0) {
                predicate.and(condition)
            } else {
                predicate.or(condition)
            }
        }
        return predicate
    }
}
