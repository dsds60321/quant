package com.gh.quant

import com.fasterxml.jackson.databind.ObjectMapper
import com.gh.quant.platform.config.SecurityConfig
import com.gh.quant.platform.controller.StrategyController
import com.gh.quant.platform.dto.FactorCandidateDto
import com.gh.quant.platform.dto.StrategyCandidateDiagnosticsDto
import com.gh.quant.platform.dto.StrategyCreateRequest
import com.gh.quant.platform.dto.StrategyCreateResponse
import com.gh.quant.platform.service.StrategyService
import java.math.BigDecimal
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post

@WebMvcTest(StrategyController::class)
@Import(SecurityConfig::class)
class StrategyControllerTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @MockBean
    lateinit var strategyService: StrategyService

    @Test
    fun `전략 생성 요청을 처리한다`() {
        val request = StrategyCreateRequest(
            name = "AI 성장 모멘텀",
            roe = BigDecimal("15"),
            pbr = BigDecimal("1"),
            momentum = BigDecimal("0"),
            stockCount = 20,
            rebalance = "monthly",
        )
        given(strategyService.createStrategy(request)).willReturn(
            StrategyCreateResponse(
                strategyId = 1L,
                candidates = listOf(FactorCandidateDto("005930", BigDecimal("0.91"))),
                diagnostics = StrategyCandidateDiagnosticsDto(
                    totalSymbols = 100,
                    priceReadyCount = 80,
                    fundamentalsReadyCount = 70,
                    roePassCount = 40,
                    pbrPassCount = 20,
                    momentumPassCount = 10,
                    finalSelectedCount = 1,
                ),
            ),
        )

        mockMvc.post("/api/strategy") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(request)
        }.andExpect {
            status { isOk() }
            jsonPath("$.success") { value(true) }
            jsonPath("$.data.strategyId") { value(1) }
            jsonPath("$.data.candidates[0].symbol") { value("005930") }
        }
    }
}
