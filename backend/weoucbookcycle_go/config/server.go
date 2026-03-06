package config

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9" // 使用最新的 go-redis/v9
)

// RedisClient 全局 Redis 客户端实例
var RedisClient *redis.Client

// InitializeRedis 初始化 Redis 客户端
func InitializeRedis() error {
	redisAddr := GetEnv("REDIS_ADDR", "localhost:6379")
	redisPassword := GetEnv("REDIS_PASSWORD", "")
	redisDB := GetEnv("REDIS_DB", "0")

	// 解析数据库编号
	db := 0
	if redisDB != "" {
		fmt.Sscanf(redisDB, "%d", &db)
	}

	// 创建Redis客户端
	RedisClient = redis.NewClient(&redis.Options{
		Addr:         redisAddr,
		Password:     redisPassword,
		DB:           db,
		PoolSize:     10,              // 连接池大小
		MinIdleConns: 5,               // 最小空闲连接
		MaxRetries:   3,               // 最大重试次数
		DialTimeout:  5 * time.Second, // 连接超时
		ReadTimeout:  3 * time.Second, // 读取超时
		WriteTimeout: 3 * time.Second, // 写入超时
		PoolTimeout:  4 * time.Second, // 从连接池获取连接的超时
	})

	// 测试连接
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := RedisClient.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Println("✅ Redis client initialized successfully")
	return nil
}

// CloseRedis 关闭 Redis 连接
func CloseRedis() error {
	if RedisClient != nil {
		return RedisClient.Close()
	}
	return nil
}

// ServerConfig 服务器配置结构
type ServerConfig struct {
	Port         string
	Mode         string
	ReadTimeout  int
	WriteTimeout int
	RedisEnabled bool // Redis是否启用
}

// GetServerConfig 获取服务器配置
func GetServerConfig() *ServerConfig {
	redisEnabled := GetEnv("REDIS_ENABLED", "true") == "true"

	return &ServerConfig{
		Port:         GetEnv("SERVER_PORT", "8080"),
		Mode:         GetEnv("GIN_MODE", "debug"),
		ReadTimeout:  30,
		WriteTimeout: 30,
		RedisEnabled: redisEnabled,
	}
}

// StartServer 已弃用，请在 main.go 中进行资源初始化
// 保留该函数以兼容旧版本调用
func StartServer() error {
	log.Println("⚠️  警告: StartServer() 已弃用，请在 main.go 初始化资源。")
	return nil
}

// GetRedisClient 获取Redis客户端实例（供其他包使用）
// 这个函数可以在控制器中调用，而不是每个controller都自己创建redis客户端
func GetRedisClient() *redis.Client {
	return RedisClient
}
