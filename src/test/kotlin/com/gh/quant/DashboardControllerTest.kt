package com.gh.quant

import com.fasterxml.jackson.databind.ObjectMapper
import com.gh.quant.platform.config.SecurityConfig
import com.gh.quant.platform.controller.DashboardController
import com.gh.quant.platform.dto.DashboardSummaryDto
import com.gh.quant.platform.service.DashboardService
import java.math.BigDecimal
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@WebMvcTest(DashboardController::class)
@Import(SecurityConfig::class)
class DashboardControllerTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @MockBean
    lateinit var dashboardService: DashboardService

    @Test
    fun `대시보드 요약을 반환한다`() {
        given(dashboardService.getDashboardSummary(1L)).willReturn(
            DashboardSummaryDto(
                portfolioValue = BigDecimal("1284000000"),
                dailyReturn = BigDecimal("1.28"),
                sharpe = BigDecimal("1.94"),
                alpha = BigDecimal("3.12"),
                maxDrawdown = BigDecimal("-7.8"),
                activeStrategies = 3,
            ),
        )

        mockMvc.get("/api/dashboard?portfolioId=1")
            .andExpect {
                status { isOk() }
                jsonPath("$.success") { value(true) }
                jsonPath("$.data.portfolioValue") { value(1284000000) }
                jsonPath("$.data.activeStrategies") { value(3) }
            }
    }
}
