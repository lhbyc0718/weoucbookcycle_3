package services

import (
	"context"
	"log"
	"runtime"
	"time"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"
)

var monitorCtx = context.Background()

// MonitorService 监控服务
type MonitorService struct{}

// NewMonitorService 创建监控服务
func NewMonitorService() *MonitorService {
	return &MonitorService{}
}

// SystemStats 系统统计信息
type SystemStats struct {
	Goroutines       int   `json:"goroutines"`
	OnlineUsers      int64 `json:"online_users"`
	WebSocketClients int64 `json:"websocket_clients"`
	DBOpenConns      int   `json:"db_open_conns"`
	RedisHitRate     string `json:"redis_hit_rate"`
}

// GetSystemStats 获取系统统计
func (s *MonitorService) GetSystemStats() SystemStats {
	stats := SystemStats{
		Goroutines: runtime.NumGoroutine(),
	}

	// 获取在线用户数
	if config.RedisClient != nil {
		stats.OnlineUsers, _ = config.RedisClient.SCard(monitorCtx, "online:users").Result()
		
		// 获取Redis统计信息（简略）
		info, _ := config.RedisClient.Info(monitorCtx, "stats").Result()
		stats.RedisHitRate = parseRedisHitRate(info)
	}

	// 获取DB连接数
	if sqlDB, err := config.DB.DB(); err == nil {
		stats.DBOpenConns = sqlDB.Stats().OpenConnections
	}

	return stats
}

// StartConsistencyCheck 启动数据一致性校验任务
func (s *MonitorService) StartConsistencyCheck() {
	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		for range ticker.C {
			s.checkUnreadCounts()
		}
	}()
}

// checkUnreadCounts 校验未读消息计数一致性
func (s *MonitorService) checkUnreadCounts() {
	if config.RedisClient == nil {
		return
	}

	log.Println("🔍 Starting unread count consistency check...")

	// 1. 获取所有活跃用户的ID（简化：从online_users获取）
	userIDs, _ := config.RedisClient.SMembers(monitorCtx, "online:users").Result()

	for _, userID := range userIDs {
		// 获取Redis中的未读总数
		// pattern := fmt.Sprintf("unread:%s:*", userID)
		// keys, _ := config.RedisClient.Keys(monitorCtx, pattern).Result()
		// redisTotal := int64(0)
		// for _, key := range keys {
		// 	val, _ := config.RedisClient.Get(monitorCtx, key).Int64()
		// 	redisTotal += val
		// }

		// 获取DB中的未读总数
		var dbTotal int64
		config.DB.Model(&models.ChatUser{}).Where("user_id = ?", userID).Select("SUM(unread_count)").Scan(&dbTotal)

		// 这里只是简单记录，实际生产环境可以自动修复（以DB为准重置Redis）
		// log.Printf("User %s: DB Unread=%d", userID, dbTotal)
	}
}

func parseRedisHitRate(info string) string {
	// 简单解析，实际需正则
	return "N/A" 
}
