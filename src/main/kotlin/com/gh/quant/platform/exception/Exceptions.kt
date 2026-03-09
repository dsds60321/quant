package com.gh.quant.platform.exception

class ResourceNotFoundException(message: String) : RuntimeException(message)
class ExternalServiceException(message: String) : RuntimeException(message)
class ValidationException(message: String) : RuntimeException(message)
