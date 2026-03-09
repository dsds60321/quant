package com.gh.quant.platform.repository.custom

import com.gh.quant.platform.dto.ScreenerStockDto
import com.gh.quant.platform.dto.StockLookupDto
import java.math.BigDecimal

interface StockQueryRepository {
    fun searchByFactors(perLt: BigDecimal?, roeGt: BigDecimal?, pbrLt: BigDecimal?): List<ScreenerStockDto>
    fun searchStocks(query: String, marketType: String?, assetGroup: String?, limit: Int): List<StockLookupDto>
}
