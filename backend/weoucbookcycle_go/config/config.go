package config

import (
	"os"
	"strconv"
)

// GetEnv 获取环境变量，如果不存在则返回默认值
func GetEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

// GetEnvInt 获取环境变量（整型）
func GetEnvInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

// GetEnvBool 获取环境变量（布尔型）
func GetEnvBool(key string, defaultValue bool) bool {
	if value, exists := os.LookupEnv(key); exists {
		if boolVal, err := strconv.ParseBool(value); err == nil {
			return boolVal
		}
	}
	return defaultValue
}

// GetUseCloud 检查是否使用微信云开发
// 默认 false，自建后端使用 MySQL
func GetUseCloud() bool {
	return GetEnvBool("USE_CLOUD", false)
}

// GetAPIBase 返回 API 基地址，可供前端设置、或者在后端生成链接时使用
func GetAPIBase() string {
	if v := os.Getenv("API_BASE"); v != "" {
		return v
	}
	return "http://localhost:8080"
}
