package utils

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

const (
	CodeSuccess             = 20000
	CodeError               = 50000
	CodeValidationError     = 40001
	CodeUnauthorized        = 40100 // Using 40100 to map to HTTP 401
	CodeForbidden           = 40300
	CodeNotFound            = 40400
	CodeInternalServerError = 50001
)

// Response 统一响应结构
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"` // 始终返回data字段，即使为空
}

// Success 成功响应 (data可以是任意类型)
func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    CodeSuccess,
		Message: "success",
		Data:    data,
	})
}

// SuccessWithMessage 带消息的成功响应
func SuccessWithMessage(c *gin.Context, message string, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    CodeSuccess,
		Message: message,
		Data:    data,
	})
}

// Error 错误响应
func Error(c *gin.Context, code int, message string) {
	// 如果code是HTTP状态码(小于1000)，转换为业务错误码或直接使用
	// 这里假设业务错误码通常 > 1000，或者是标准的HTTP状态码
	// 为了统一，我们尽量保持HTTP状态码为200，通过Code字段区分错误
	// 但Gin的c.JSON第一个参数是HTTP状态码，对于错误情况，
	// 如果前端依赖HTTP状态码捕获错误(如axios拦截器)，则应返回对应4xx/5xx

	httpStatus := http.StatusOK
	if code == CodeUnauthorized {
		httpStatus = http.StatusUnauthorized
	} else if code == CodeForbidden {
		httpStatus = http.StatusForbidden
	} else if code == CodeNotFound {
		httpStatus = http.StatusNotFound
	} else if code == CodeInternalServerError {
		httpStatus = http.StatusInternalServerError
	} else if code < 1000 {
		httpStatus = code
	}

	c.JSON(httpStatus, Response{
		Code:    code,
		Message: message,
		Data:    nil,
	})
}

// Unauthorized 未授权响应
func Unauthorized(c *gin.Context, message string) {
	if message == "" {
		message = "Unauthorized"
	}
	Error(c, http.StatusUnauthorized, message)
}

// NotFound 未找到响应
func NotFound(c *gin.Context, message string) {
	if message == "" {
		message = "Not Found"
	}
	Error(c, http.StatusNotFound, message)
}

// InternalError 服务器内部错误响应
func InternalError(c *gin.Context, message string) {
	if message == "" {
		message = "Internal Server Error"
	}
	Error(c, http.StatusInternalServerError, message)
}
