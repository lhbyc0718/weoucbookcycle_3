package utils

import (
	"log"
)

// CaptureError 是一个错误监控占位符，后续可以集成 Sentry/其他监控服务
func CaptureError(context string, err error) {
	if err == nil {
		return
	}
	// 目前仅记录为日志，避免输出敏感信息
	log.Printf("[ERROR] %s: %v", context, err)
}
