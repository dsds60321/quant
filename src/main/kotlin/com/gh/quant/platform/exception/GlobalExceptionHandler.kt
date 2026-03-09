package com.gh.quant.platform.exception

import com.gh.quant.platform.dto.ApiResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {
    @ExceptionHandler(ResourceNotFoundException::class)
    fun handleNotFound(ex: ResourceNotFoundException): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.fail(ex.message ?: "리소스를 찾을 수 없습니다."))

    @ExceptionHandler(ExternalServiceException::class)
    fun handleExternal(ex: ExternalServiceException): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(ApiResponse.fail(ex.message ?: "외부 엔진 호출에 실패했습니다."))

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity.badRequest().body(ApiResponse.fail("요청 값이 올바르지 않습니다."))

    @ExceptionHandler(ValidationException::class)
    fun handleBusinessValidation(ex: ValidationException): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity.badRequest().body(ApiResponse.fail(ex.message ?: "요청 값이 올바르지 않습니다."))

    @ExceptionHandler(Exception::class)
    fun handleUnknown(): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiResponse.fail("서버 내부 오류가 발생했습니다."))
}
