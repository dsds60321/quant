package com.gh.quant.platform.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.SecurityFilterChain
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
class SecurityConfig(
    @Value("\${platform.cors.allowed-origins:http://localhost:3000,http://127.0.0.1:3000}") private val corsAllowedOrigins: String,
) {
    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain = http
        .csrf { it.disable() }
        .cors { }
        .authorizeHttpRequests { auth -> auth.anyRequest().permitAll() }
        .build()

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val configuredOrigins = corsAllowedOrigins.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        val configuration = CorsConfiguration().apply {
            allowedOriginPatterns = configuredOrigins
            allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            allowedHeaders = listOf("*")
            allowCredentials = true
            maxAge = 3600
        }

        return UrlBasedCorsConfigurationSource().apply {
            registerCorsConfiguration("/**", configuration)
        }
    }
}
