package com.gh.quant

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@EnableScheduling
@SpringBootApplication
class QuantApplication

fun main(args: Array<String>) {
    runApplication<QuantApplication>(*args)
}
