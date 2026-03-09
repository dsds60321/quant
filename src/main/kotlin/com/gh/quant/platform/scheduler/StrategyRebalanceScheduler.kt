package com.gh.quant.platform.scheduler

import com.gh.quant.platform.repository.StrategyRunRepository
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

@Component
class StrategyRebalanceScheduler(
    private val strategyRunRepository: StrategyRunRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(cron = "\${platform.scheduler.rebalance-cron}")
    fun scheduleRebalance() {
        val runningCount = strategyRunRepository.countByStatus("RUNNING")
        log.info("전략 리밸런싱 스케줄러 실행, 실행중 전략 수={}", runningCount)
    }
}
