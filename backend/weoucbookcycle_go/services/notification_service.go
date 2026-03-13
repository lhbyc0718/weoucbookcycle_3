package services

import (
	"context"
	"encoding/json"
	"fmt"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"

	"github.com/redis/go-redis/v9"
)

// NotificationService 通知服务
type NotificationService struct {
	redis *redis.Client
}

// NewNotificationService 创建实例
func NewNotificationService() *NotificationService {
	return &NotificationService{redis: config.GetRedisClient()}
}

// CreateNotification 创建并发布通知
func (ns *NotificationService) CreateNotification(userID, ntype, actorID, txID string, data interface{}) (*models.Notification, error) {
	var dataStr string
	if data != nil {
		b, err := json.Marshal(data)
		if err == nil {
			dataStr = string(b)
		}
	}

	notif := models.Notification{
		UserID:        userID,
		ActorID:       actorID,
		Type:          ntype,
		TransactionID: txID,
		Data:          dataStr,
		IsRead:        false,
	}

	if err := config.DB.Create(&notif).Error; err != nil {
		return nil, err
	}

	// 发布到 Redis 频道，供 websocket 或其他订阅者使用
	if ns.redis != nil {
		ch := fmt.Sprintf("notifications:%s", userID)
		// 简单消息体，包含通知ID和类型
		payload := map[string]interface{}{
			"id":             notif.ID,
			"type":           notif.Type,
			"transaction_id": notif.TransactionID,
			"data":           notif.Data,
			"created_at":     notif.CreatedAt,
			"action":         "created",
		}
		b, _ := json.Marshal(payload)
		_ = ns.redis.Publish(context.Background(), ch, string(b)).Err()

		// 兼容 websocket 的 Redis 广播订阅：发布到通用频道并包含接收者ID
		wrapper := map[string]interface{}{
			"receiver_ids": []string{userID},
			"type":         "notification",
			"data":         payload,
		}
		wb, _ := json.Marshal(wrapper)
		_ = ns.redis.Publish(context.Background(), "chat:notification", string(wb)).Err()
	}

	return &notif, nil
}

// ListNotifications 列表（支持按 type 过滤和只返回未读）
func (ns *NotificationService) ListNotifications(userID, ntype string, onlyNew bool, limit, offset int) ([]models.Notification, error) {
	var notifs []models.Notification
	q := config.DB.Model(&models.Notification{}).Where("user_id = ?", userID)
	if ntype != "" {
		q = q.Where("type = ?", ntype)
	}
	if onlyNew {
		q = q.Where("is_read = ?", false)
	}
	if limit == 0 {
		limit = 50
	}
	if err := q.Order("created_at desc").Limit(limit).Offset(offset).Find(&notifs).Error; err != nil {
		return nil, err
	}
	return notifs, nil
}

// MarkRead 标记单个通知为已读
func (ns *NotificationService) MarkRead(id, userID string) error {
	return config.DB.Model(&models.Notification{}).Where("id = ? AND user_id = ?", id, userID).Update("is_read", true).Error
}

// MarkAllRead 标记某用户所有通知为已读
func (ns *NotificationService) MarkAllRead(userID string) error {
	return config.DB.Model(&models.Notification{}).Where("user_id = ? AND is_read = ?", userID, false).Update("is_read", true).Error
}

// UnreadCount 返回未读通知数量
func (ns *NotificationService) UnreadCount(userID string) (int64, error) {
	var cnt int64
	if err := config.DB.Model(&models.Notification{}).Where("user_id = ? AND is_read = ?", userID, false).Count(&cnt).Error; err != nil {
		return 0, err
	}
	return cnt, nil
}
