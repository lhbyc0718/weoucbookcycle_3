package controllers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"
	"weoucbookcycle_go/services"
	"weoucbookcycle_go/utils"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

var ctx = context.Background()

// ChatController 聊天控制器
type ChatController struct {
	redisClient *redis.Client
}

// NewChatController 创建聊天控制器实例
func NewChatController() *ChatController {
	return &ChatController{
		redisClient: config.GetRedisClient(),
	}
}

// processMessage 处理消息
func (cc *ChatController) processMessage(chatID, userID, content string) error {
	// 使用 ChatService 处理消息发送，确保逻辑统一
	chatService := services.NewChatService()
	_, err := chatService.SendMessage(chatID, userID, content)
	return err
}

// GetChats 获取聊天列表
// @Summary 获取聊天列表
// @Description 获取当前用户的聊天列表，包含每个聊天的未读消息数
// @Tags chats
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {array} models.ChatResponse
// @Router /api/v1/chats [get]
// GetChats 获取聊天列表
func (cc *ChatController) GetChats(c *gin.Context) {
	userID := c.GetString("user_id")

	// 获取用户参与的聊天关系（包含数据库中的未读数）
	var chatUsers []models.ChatUser
	if err := config.DB.Where("user_id = ?", userID).Find(&chatUsers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get chats"})
		return
	}

	// 如果没有聊天，返回空数组
	if len(chatUsers) == 0 {
		c.JSON(http.StatusOK, gin.H{"chats": []models.ChatResponse{}})
		return
	}

	// 提取聊天ID列表
	chatIDs := make([]string, len(chatUsers))
	for i, cu := range chatUsers {
		chatIDs[i] = cu.ChatID
	}

	// 批量查询聊天详情
	var chats []models.Chat
	if err := config.DB.
		Preload("Users").
		Preload("Users.User").
		Where("id IN ?", chatIDs).
		Find(&chats).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get chats"})
		return
	}

	// 转换为响应结构
	var chatResponses []models.ChatResponse
	for _, chat := range chats {
		// 从Redis获取最新的未读数（如果有）
		var unreadCount int64

		if config.RedisClient != nil {
			unreadKey := "unread:" + userID + ":" + chat.ID
			unread, err := config.RedisClient.Get(ctx, unreadKey).Int64()
			if err == nil {
				unreadCount = unread
			}
		}

		// 如果Redis中没有，使用数据库中的值（从ChatUser中获取）
		if unreadCount == 0 {
			// 从chatUsers中找到对应的ChatUser获取未读数
			for _, cu := range chatUsers {
				if cu.ChatID == chat.ID {
					unreadCount = int64(cu.UnreadCount)
					break
				}
			}
		}

		chatResponses = append(chatResponses, chat.ToChatResponse(unreadCount))
	}

	c.JSON(http.StatusOK, gin.H{"chats": chatResponses})
}

// GetChat 获取聊天详情
// @Summary 获取聊天详情
// @Description 根据聊天ID获取详细信息
// @Tags chats
// @Accept json
// @Produce json
// @Param id path string true "聊天ID"
// @Security Bearer
// @Success 200 {object} models.Chat
// @Router /api/v1/chats/{id} [get]
func (cc *ChatController) GetChat(c *gin.Context) {
	userID := c.GetString("userID")
	chatID := c.Param("id")

	// 检查用户是否有权限访问该聊天
	var chatUser models.ChatUser
	if err := config.DB.Where("chat_id = ? AND user_id = ?", chatID, userID).First(&chatUser).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have permission to access this chat"})
		return
	}

	// 先尝试从Redis缓存获取
	cacheKey := "chat:" + chatID
	cached, err := cc.redisClient.Get(ctx, cacheKey).Result()
	if err == nil {
		var chat models.Chat
		if json.Unmarshal([]byte(cached), &chat) == nil {
			c.JSON(http.StatusOK, chat)
			return
		}
	}

	// 从数据库查询
	var chat models.Chat
	if err := config.DB.
		Preload("Users").
		Preload("Users.User").
		Preload("Messages").
		Preload("Messages.Sender").
		First(&chat, "id = ?", chatID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found"})
		return
	}

	// 异步缓存到Redis
	go func() {
		data, _ := json.Marshal(chat)
		cc.redisClient.Set(ctx, cacheKey, data, time.Minute*10)
	}()

	c.JSON(http.StatusOK, chat)
}

// CreateChat 创建聊天室
func (cc *ChatController) CreateChat(c *gin.Context) {
	var req struct {
		UserID string `json:"user_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid request body")
		return
	}

	currentUserID := c.GetString("user_id")
	if currentUserID == "" {
		utils.Unauthorized(c, "")
		return
	}

	// 检查目标用户是否存在
	var targetUser models.User
	if err := config.DB.First(&targetUser, "id = ?", req.UserID).Error; err != nil {
		utils.NotFound(c, "Target user not found")
		return
	}

	// 检查是否已经存在聊天室
	// 这里简化处理，实际应该查询两个用户是否已有共同的私聊Chat
	// 假设ChatUser表关联了Chat和User
	// 查找同时包含这两个用户的ChatID

	/*
		SELECT c.id FROM chats c
		JOIN chat_users cu1 ON c.id = cu1.chat_id AND cu1.user_id = ?
		JOIN chat_users cu2 ON c.id = cu2.chat_id AND cu2.user_id = ?
		LIMIT 1
	*/

	var existingChatID string
	err := config.DB.Raw(`
		SELECT c.id FROM chats c
		JOIN chat_users cu1 ON c.id = cu1.chat_id AND cu1.user_id = ?
		JOIN chat_users cu2 ON c.id = cu2.chat_id AND cu2.user_id = ?
		LIMIT 1
	`, currentUserID, req.UserID).Scan(&existingChatID).Error

	if err == nil && existingChatID != "" {
		// 如果已存在，直接返回该聊天室信息
		var chat models.Chat
		config.DB.Preload("Participants").First(&chat, "id = ?", existingChatID)
		utils.Success(c, chat)
		return
	}

	// 创建新聊天室
	chat := models.Chat{
		ID: utils.GenerateUUID(), // 假设有这个工具函数，或者GORM hook生成
		// Type:      "private", // 默认为私聊 (模型中暂无此字段)
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if chat.ID == "" {
		// 如果没有自动生成，手动生成一个简单的ID (生产环境应使用UUID库)
		chat.ID = fmt.Sprintf("%d", time.Now().UnixNano())
	}

	tx := config.DB.Begin()
	if err := tx.Create(&chat).Error; err != nil {
		tx.Rollback()
		utils.InternalError(c, "Failed to create chat")
		return
	}

	// 添加参与者
	participants := []models.ChatUser{
		{ChatID: chat.ID, UserID: currentUserID, CreatedAt: time.Now()},
		{ChatID: chat.ID, UserID: req.UserID, CreatedAt: time.Now()},
	}

	if err := tx.Create(&participants).Error; err != nil {
		tx.Rollback()
		utils.InternalError(c, "Failed to add participants")
		return
	}

	tx.Commit()

	// 重新加载带参与者信息的Chat
	config.DB.Preload("Participants").First(&chat, "id = ?", chat.ID)

	utils.Success(c, chat)
}

// GetMessages 获取聊天消息
// @Summary 获取聊天消息
// @Description 获取聊天的消息列表（分页）
// @Tags chats
// @Accept json
// @Produce json
// @Param id path string true "聊天ID"
// @Param page query int false "页码" default(1)
// @Param limit query int false "每页数量" default(50)
// @Security Bearer
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/chats/{id}/messages [get]
func (cc *ChatController) GetMessages(c *gin.Context) {
	userID := c.GetString("user_id")
	chatID := c.Param("id")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset := (page - 1) * limit

	// 检查权限
	var chatUser models.ChatUser
	if err := config.DB.Where("chat_id = ? AND user_id = ?", chatID, userID).First(&chatUser).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have permission to access this chat"})
		return
	}

	// 从Redis获取缓存消息
	cacheKey := "chat:" + chatID + ":messages:page:" + strconv.Itoa(page)
	cached, err := cc.redisClient.Get(ctx, cacheKey).Result()
	if err == nil {
		var messages []models.Message
		if json.Unmarshal([]byte(cached), &messages) == nil {
			c.JSON(http.StatusOK, gin.H{
				"messages": messages,
				"page":     page,
				"limit":    limit,
			})
			return
		}
	}

	// 从数据库查询
	var messages []models.Message
	var total int64

	config.DB.Model(&models.Message{}).Where("chat_id = ?", chatID).Count(&total)

	if err := config.DB.
		Preload("Sender").
		Where("chat_id = ?", chatID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&messages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get messages"})
		return
	}

	// 反转消息顺序（最新的在最前面）
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	// 标记消息为已读
	go func() {
		config.DB.Model(&models.Message{}).
			Where("chat_id = ? AND sender_id != ?", chatID, userID).
			Update("is_read", true)

		// 清除Redis中的未读计数
		cc.redisClient.Del(ctx, "unread:"+userID+":"+chatID)
	}()

	// 异步缓存消息
	go func() {
		data, _ := json.Marshal(messages)
		cc.redisClient.Set(ctx, cacheKey, data, time.Minute*5)
	}()

	c.JSON(http.StatusOK, gin.H{
		"messages": messages,
		"total":    total,
		"page":     page,
		"limit":    limit,
	})
}

// SendMessage 发送消息
// @Summary 发送消息
// @Description 在指定聊天中发送新消息
// @Tags chats
// @Accept json
// @Produce json
// @Param id path string true "聊天ID"
// @Param request body map[string]interface{} true "消息内容" example='{"content":"Hello"}'
// @Security Bearer
// @Success 201 {object} models.Message
// @Router /api/v1/chats/{id}/messages [post]
func (cc *ChatController) SendMessage(c *gin.Context) {
	userID := c.GetString("user_id")
	chatID := c.Param("id")

	var req struct {
		Content string `json:"content" binding:"required,max=1000"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 检查权限
	var chatUser models.ChatUser
	if err := config.DB.Where("chat_id = ? AND user_id = ?", chatID, userID).First(&chatUser).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have permission to send messages in this chat"})
		return
	}

	// 直接处理消息（不再使用内部队列，依靠Go的并发能力）
	go func() {
		cc.processMessage(chatID, userID, req.Content)
	}()

	c.JSON(http.StatusCreated, gin.H{"message": "Message sent successfully"})
}

// GetUnreadCount 获取未读消息数
// @Summary 获取未读消息数
// @Description 获取当前用户的所有未读消息数量
// @Tags chats
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/chats/unread [get]
func (cc *ChatController) GetUnreadCount(c *gin.Context) {
	userID := c.GetString("user_id")

	// 获取所有未读key
	pattern := "unread:" + userID + ":*"
	keys, _ := cc.redisClient.Keys(ctx, pattern).Result()

	totalUnread := 0
	chatUnread := make(map[string]int64)

	for _, key := range keys {
		// 提取chat_id
		chatID := key[len("unread:"+userID+":"):]

		// 获取未读数
		count, _ := cc.redisClient.Get(ctx, key).Int64()
		totalUnread += int(count)
		chatUnread[chatID] = count
	}

	c.JSON(http.StatusOK, gin.H{
		"total_unread": totalUnread,
		"chat_unread":  chatUnread,
	})
}

// GetOnlineUsers 获取在线用户列表
// @Summary 获取在线用户列表
// @Description 获取当前在线的用户列表
// @Tags chats
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/chats/online-users [get]
func (cc *ChatController) GetOnlineUsers(c *gin.Context) {
	chatService := services.NewChatService()

	onlineUsers, err := chatService.GetOnlineUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 50000, "message": err.Error()})
		return
	}

	// 获取在线用户详细信息
	var users []models.User
	if len(onlineUsers) > 0 {
		config.DB.Where("id IN ?", onlineUsers).Find(&users)
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    20000,
		"message": "Success",
		"data": gin.H{
			"online_users": users,
			"count":        len(onlineUsers),
		},
	})
}

// MarkAsRead 标记消息为已读
// @Summary 标记消息为已读
// @Description 标记指定聊天的所有未读消息为已读
// @Tags chats
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path string true "聊天ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/chats/:id/read [put]
func (cc *ChatController) MarkAsRead(c *gin.Context) {
	userID := c.GetString("user_id")
	chatID := c.Param("id")

	chatService := services.NewChatService()

	if err := chatService.MarkAsRead(chatID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 50000, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    20000,
		"message": "Messages marked as read",
	})
}

// DeleteChat 删除聊天
// @Summary 删除聊天
// @Description 删除指定聊天
// @Tags chats
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path string true "聊天ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/chats/:id [delete]
func (cc *ChatController) DeleteChat(c *gin.Context) {
	userID := c.GetString("user_id")
	chatID := c.Param("id")

	chatService := services.NewChatService()

	if err := chatService.DeleteChat(chatID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 50000, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    20000,
		"message": "Chat deleted successfully",
	})
}
