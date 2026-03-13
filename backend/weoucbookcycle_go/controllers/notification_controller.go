package controllers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/services"
	"weoucbookcycle_go/utils"

	"github.com/gin-gonic/gin"
)

// NotificationController 通知控制器
type NotificationController struct{}

// NewNotificationController 创建实例
func NewNotificationController() *NotificationController {
	return &NotificationController{}
}

// ListNotifications 列表
func (nc *NotificationController) ListNotifications(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		utils.Unauthorized(c, "")
		return
	}

	ntype := c.Query("type")
	onlyNew := c.Query("new") == "true"
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")
	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	ns := services.NewNotificationService()
	items, err := ns.ListNotifications(userID, ntype, onlyNew, limit, offset)
	if err != nil {
		utils.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	utils.Success(c, items)
}

// MarkRead 标记为已读
func (nc *NotificationController) MarkRead(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		utils.Unauthorized(c, "")
		return
	}
	id := c.Param("id")
	ns := services.NewNotificationService()
	if err := ns.MarkRead(id, userID); err != nil {
		utils.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	// publish read event to Redis so other client sessions can sync
	if config.RedisClient != nil {
		wrapper := map[string]interface{}{
			"receiver_ids": []string{userID},
			"type":         "notification",
			"data": map[string]interface{}{
				"action": "read",
				"id":     id,
			},
		}
		if b, err := json.Marshal(wrapper); err == nil {
			_ = config.RedisClient.Publish(c, "chat:notification", string(b)).Err()
		}
	}

	utils.Success(c, gin.H{"marked": true})
}

// MarkAllRead 标记全部为已读
func (nc *NotificationController) MarkAllRead(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		utils.Unauthorized(c, "")
		return
	}
	ns := services.NewNotificationService()
	if err := ns.MarkAllRead(userID); err != nil {
		utils.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	// publish mark-all-read event
	if config.RedisClient != nil {
		wrapper := map[string]interface{}{
			"receiver_ids": []string{userID},
			"type":         "notification",
			"data": map[string]interface{}{
				"action": "mark_all_read",
			},
		}
		if b, err := json.Marshal(wrapper); err == nil {
			_ = config.RedisClient.Publish(c, "chat:notification", string(b)).Err()
		}
	}

	utils.Success(c, gin.H{"marked_all": true})
}

// GetUnreadCount 返回当前用户未读通知数量
func (nc *NotificationController) GetUnreadCount(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		utils.Unauthorized(c, "")
		return
	}
	svc := services.NewNotificationService()
	cnt, err := svc.UnreadCount(userID)
	if err != nil {
		utils.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	utils.Success(c, gin.H{"unread_notifications": cnt})
}
