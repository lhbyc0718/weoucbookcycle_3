package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"
	"weoucbookcycle_go/utils"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// ChatService 聊天服务
type ChatService struct {
	// 消息发送队列
	messageQueue chan *MessageTask
	// 消息处理队列
	processQueue chan *MessageProcessTask
	// 在线用户缓存
	onlineUsers sync.Map // userID -> LastSeen
}

// MessageTask 消息发送任务
type MessageTask struct {
	ChatID    string
	UserID    string
	Content   string
	Type      string
	Timestamp time.Time
}

// MessageProcessTask 消息处理任务
type MessageProcessTask struct {
	Message *models.Message
}

// ChatWithUnread 带未读数的聊天
type ChatWithUnread struct {
	Chat        models.Chat `json:"chat"`
	UnreadCount int64       `json:"unread_count"`
}

// NewChatService 创建聊天服务实例
func NewChatService() *ChatService {
	cs := &ChatService{
		messageQueue: make(chan *MessageTask, 2000),
		processQueue: make(chan *MessageProcessTask, 2000),
	}

	// 启动worker池
	cs.startWorkers()

	// 启动在线用户清理
	go cs.cleanupOnlineUsers()

	return cs
}

// ==================== 聊天管理方法 ====================

// CreateChat 创建聊天
func (cs *ChatService) CreateChat(initiatorID, targetUserID string) (*models.Chat, error) {
	// 1. 不能创建与自己的聊天
	if initiatorID == targetUserID {
		return nil, errors.New("cannot create chat with yourself")
	}

	// 2. 检查目标用户是否存在
	var targetUser models.User
	if err := config.DB.First(&targetUser, "id = ?", targetUserID).Error; err != nil {
		return nil, errors.New("target user not found")
	}

	// 3. 检查是否已存在这两个用户的聊天
	var existingChat models.Chat
	var existingChatUser models.ChatUser

	err := config.DB.
		Joins("JOIN chat_users ON chat_users.chat_id = chats.id").
		Where("chat_users.user_id = ?", initiatorID).
		Order("chats.updated_at DESC").
		First(&existingChat).Error

	if err == nil {
		// 检查是否也包含目标用户
		err = config.DB.
			Where("chat_id = ? AND user_id = ?", existingChat.ID, targetUserID).
			First(&existingChatUser).Error

		if err == nil {
			// 聊天已存在，返回现有聊天
			return &existingChat, nil
		}
	}

	// 4. 创建新聊天
	chat := models.Chat{}
	chat.LastMessage = ""
	chat.UpdatedAt = time.Now()

	if err := config.DB.Create(&chat).Error; err != nil {
		return nil, fmt.Errorf("failed to create chat: %w", err)
	}

	// 5. 添加聊天用户（使用goroutine并发插入）
	var wg sync.WaitGroup
	users := []string{initiatorID, targetUserID}

	for _, uid := range users {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			chatUser := models.ChatUser{
				ChatID:      chat.ID,
				UserID:      id,
				UnreadCount: 0,
			}
			config.DB.Create(&chatUser)
		}(uid)
	}
	wg.Wait()

	// 6. 异步缓存到Redis
	go cs.cacheChat(&chat)

	// 7. 异步通知用户（如果有WebSocket连接）
	go cs.notifyChatCreated(&chat, initiatorID, targetUserID)

	// 8. 记录聊天创建事件
	go func() {
		if config.RedisClient != nil {
			config.RedisClient.XAdd(redisCtx, &redis.XAddArgs{
				Stream: "chat_events",
				Values: map[string]interface{}{
					"event":          "chat_created",
					"chat_id":        chat.ID,
					"initiator_id":   initiatorID,
					"target_user_id": targetUserID,
					"timestamp":      time.Now().Unix(),
				},
			})
		}
	}()

	return &chat, nil
}

// DeleteChat 删除聊天
func (cs *ChatService) DeleteChat(chatID, userID string) error {
	// 1. 检查用户是否有权限删除
	var chatUser models.ChatUser
	if err := config.DB.Where("chat_id = ? AND user_id = ?", chatID, userID).First(&chatUser).Error; err != nil {
		return errors.New("you don't have permission to delete this chat")
	}

	// 2. 仅删除当前用户的会话条（从 chat_users 表删除），保留聊天消息
	if err := config.DB.Delete(&models.ChatUser{}, "chat_id = ? AND user_id = ?", chatID, userID).Error; err != nil {
		return fmt.Errorf("failed to remove chat for user: %w", err)
	}

	// 3. 如果该聊天已没有参与者，则删除聊天本身及其消息以清理孤儿数据
	var cnt int64
	config.DB.Model(&models.ChatUser{}).Where("chat_id = ?", chatID).Count(&cnt)
	if cnt == 0 {
		// 删除消息
		config.DB.Where("chat_id = ?", chatID).Delete(&models.Message{})
		// 删除chat
		config.DB.Delete(&models.Chat{}, "id = ?", chatID)
	}

	// 4. 清除缓存
	go cs.clearChatCaches(chatID)

	return nil
}

// ClearMessages 清空指定聊天的所有消息（需要用户为参与者）
func (cs *ChatService) ClearMessages(chatID, userID string) error {
	var chatUser models.ChatUser
	if err := config.DB.Where("chat_id = ? AND user_id = ?", chatID, userID).First(&chatUser).Error; err != nil {
		return errors.New("you don't have permission to clear messages in this chat")
	}

	if err := config.DB.Where("chat_id = ?", chatID).Delete(&models.Message{}).Error; err != nil {
		return fmt.Errorf("failed to clear messages: %w", err)
	}

	// 清除缓存
	cs.clearChatCaches(chatID)
	return nil
}

// ==================== 消息方法 ====================

// SendMessage 发送消息
// 优化：采用 DB-First 策略，先持久化再异步广播，防止消息丢失
func (cs *ChatService) SendMessage(chatID, userID, content, msgType string) (*models.Message, error) {
	// 1. 验证内容
	if content == "" {
		return nil, errors.New("message content cannot be empty")
	}
	if len(content) > 1000 {
		return nil, errors.New("message content is too long (max 1000 characters)")
	}
	// 转换任何表情代码为 Unicode（例如 :smile: -> 😄）
	content = utils.ConvertEmojiCodesToUnicode(content)

	if msgType == "" {
		msgType = "text"
	}

	// 2. 检查用户是否有权限发送消息
	var chatUser models.ChatUser
	if err := config.DB.Where("chat_id = ? AND user_id = ?", chatID, userID).First(&chatUser).Error; err != nil {
		return nil, errors.New("you don't have permission to send messages in this chat")
	}

	// 2.1 检查接收者是否已将发送者拉黑（如果有任何接收者拉黑发送者，则阻止发送）
	var participants []models.ChatUser
	if err := config.DB.Where("chat_id = ?", chatID).Find(&participants).Error; err == nil {
		for _, p := range participants {
			if p.UserID == userID {
				continue
			}
			// 检查 p.UserID 是否拉黑了 userID
			var b models.Block
			if err := config.DB.Where("blocker_id = ? AND blocked_id = ?", p.UserID, userID).First(&b).Error; err == nil {
				return nil, errors.New("发送消息失败，对方已拉黑")
			}
		}
	}

	// 3. 立即持久化到数据库 (Sync)
	message := models.Message{
		ChatID:   chatID,
		SenderID: userID,
		Content:  content,
		Type:     msgType,
		IsRead:   false,
	}

	if err := config.DB.Create(&message).Error; err != nil {
		return nil, fmt.Errorf("failed to save message: %w", err)
	}

	// 4. 将后置处理任务放入队列 (Async)
	// 如果队列满，选择非阻塞丢弃（或者降级为同步执行，这里选择降级）
	task := &MessageProcessTask{Message: &message}

	select {
	case cs.processQueue <- task:
		// 成功入队
	default:
		// 队列满，降级为同步执行后置处理（防止广播丢失）
		go cs.processAfterSend(task)
	}

	return &message, nil
}

// GetMessages 获取聊天消息
func (cs *ChatService) GetMessages(chatID, userID string, page, limit int) ([]models.Message, int64, error) {
	offset := (page - 1) * limit

	// 1. 检查权限
	var chatUser models.ChatUser
	if err := config.DB.Where("chat_id = ? AND user_id = ?", chatID, userID).First(&chatUser).Error; err != nil {
		return nil, 0, errors.New("you don't have permission to access this chat")
	}

	// 2. 构建缓存key
	cacheKey := fmt.Sprintf("chat:%s:messages:page:%d", chatID, page)

	// 3. 尝试从Redis获取
	if config.RedisClient != nil {
		cached, err := config.RedisClient.Get(redisCtx, cacheKey).Result()
		if err == nil {
			var result struct {
				Messages []models.Message `json:"messages"`
				Total    int64            `json:"total"`
			}
			if json.Unmarshal([]byte(cached), &result) == nil {
				return result.Messages, result.Total, nil
			}
		}
	}

	// 4. 从数据库查询
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
		return nil, 0, fmt.Errorf("failed to get messages: %w", err)
	}

	// 5. 反转消息顺序（最新的在最前面）
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	// 6. 异步缓存消息
	go func() {
		if config.RedisClient != nil {
			result := struct {
				Messages []models.Message `json:"messages"`
				Total    int64            `json:"total"`
			}{messages, total}
			data, _ := json.Marshal(result)
			config.RedisClient.Set(redisCtx, cacheKey, data, 5*time.Minute)
		}
	}()

	// 7. 标记消息为已读（异步）
	go cs.MarkAsRead(chatID, userID)

	return messages, total, nil
}

// ==================== 聊天列表方法 ====================

// GetChats 获取用户的聊天列表
func (cs *ChatService) GetChats(userID string) ([]ChatWithUnread, error) {
	// 1. 获取用户参与的聊天关系
	var chatUsers []models.ChatUser
	if err := config.DB.Where("user_id = ?", userID).Find(&chatUsers).Error; err != nil {
		return nil, fmt.Errorf("failed to get chats: %w", err)
	}

	if len(chatUsers) == 0 {
		return []ChatWithUnread{}, nil
	}

	// 2. 提取聊天ID列表
	chatIDs := make([]string, len(chatUsers))
	for i, cu := range chatUsers {
		chatIDs[i] = cu.ChatID
	}

	// 3. 并发获取聊天详情和未读数
	var chats []ChatWithUnread
	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, cu := range chatUsers {
		wg.Add(1)
		go func(chatUser models.ChatUser) {
			defer wg.Done()

			var chat models.Chat
			if err := config.DB.
				Preload("Users").
				Preload("Users.User").
				Where("id = ?", chatUser.ChatID).
				First(&chat).Error; err == nil {

				// 优先从Redis获取未读数，如果没有则使用数据库中的值
				var unreadCount int64 = int64(chatUser.UnreadCount)

				if config.RedisClient != nil {
					unreadKey := fmt.Sprintf("unread:%s:%s", userID, chatUser.ChatID)
					unread, err := config.RedisClient.Get(redisCtx, unreadKey).Int64()
					if err == nil {
						unreadCount = unread
					} else {
						// 如果Redis中没有，将数据库的值同步到Redis
						config.RedisClient.Set(redisCtx, unreadKey, unreadCount, 7*24*time.Hour)
					}
				}

				// 构建响应
				chatWithUnread := ChatWithUnread{
					Chat:        chat,
					UnreadCount: unreadCount,
				}

				mu.Lock()
				chats = append(chats, chatWithUnread)
				mu.Unlock()
			}
		}(cu)
	}

	wg.Wait()

	// 按更新时间排序
	for i := 0; i < len(chats)-1; i++ {
		for j := i + 1; j < len(chats); j++ {
			if chats[i].Chat.UpdatedAt.Before(chats[j].Chat.UpdatedAt) {
				chats[i], chats[j] = chats[j], chats[i]
			}
		}
	}

	return chats, nil
}

// ==================== 未读消息方法 ====================

// MarkAsRead 标记消息为已读
func (cs *ChatService) MarkAsRead(chatID, userID string) error {
	// 1. 更新数据库
	if err := config.DB.Model(&models.Message{}).
		Where("chat_id = ? AND sender_id != ?", chatID, userID).
		Update("is_read", true).Error; err != nil {
		return fmt.Errorf("failed to mark messages as read: %w", err)
	}

	// 更新chat_users表的unread_count
	config.DB.Model(&models.ChatUser{}).
		Where("chat_id = ? AND user_id = ?", chatID, userID).
		Update("unread_count", 0)

	// 2. 清除Redis中的未读计数
	if config.RedisClient != nil {
		unreadKey := fmt.Sprintf("unread:%s:%s", userID, chatID)
		config.RedisClient.Del(redisCtx, unreadKey)
		// 清除未读交易标记
		txKey := fmt.Sprintf("unread_tx:%s:%s", userID, chatID)
		config.RedisClient.Del(redisCtx, txKey)
	}

	return nil
}

// GetUnreadCount 获取未读消息数
func (cs *ChatService) GetUnreadCount(userID string) (map[string]int64, int64, error) {
	if config.RedisClient == nil {
		return nil, 0, errors.New("redis not available")
	}

	// 获取所有未读key
	pattern := fmt.Sprintf("unread:%s:*", userID)
	keys, err := config.RedisClient.Keys(redisCtx, pattern).Result()
	if err != nil {
		return nil, 0, err
	}

	totalUnread := int64(0)
	chatUnread := make(map[string]int64)

	// 仅在能成功解析为整数时计入总数，忽略非法或损坏的值
	for _, key := range keys {
		// 提取chat_id
		prefix := fmt.Sprintf("unread:%s:", userID)
		if len(key) <= len(prefix) {
			continue
		}
		chatID := key[len(prefix):]

		// 获取未读数
		count, err := config.RedisClient.Get(redisCtx, key).Int64()
		if err != nil {
			// 忽略该键（可能已过期或值非整型）
			continue
		}
		if count <= 0 {
			// skip zero or negative values
			continue
		}
		totalUnread += count
		chatUnread[chatID] = count
	}

	return chatUnread, totalUnread, nil
}

// ==================== 在线用户方法 ====================

// SetUserOnline 设置用户在线
func (cs *ChatService) SetUserOnline(userID string) {
	cs.onlineUsers.Store(userID, time.Now())

	if config.RedisClient != nil {
		config.RedisClient.Set(redisCtx, "online:"+userID, "1", 5*time.Minute)
		config.RedisClient.SAdd(redisCtx, "online:users", userID)
	}
}

// SetUserOffline 设置用户离线
func (cs *ChatService) SetUserOffline(userID string) {
	cs.onlineUsers.Delete(userID)

	if config.RedisClient != nil {
		config.RedisClient.Del(redisCtx, "online:"+userID)
		config.RedisClient.SRem(redisCtx, "online:users", userID)
	}
}

// IsUserOnline 检查用户是否在线
func (cs *ChatService) IsUserOnline(userID string) bool {
	// 1. 检查内存缓存
	if _, exists := cs.onlineUsers.Load(userID); exists {
		return true
	}

	// 2. 检查Redis
	if config.RedisClient != nil {
		exists, _ := config.RedisClient.Exists(redisCtx, "online:"+userID).Result()
		return exists > 0
	}

	return false
}

// GetOnlineUsers 获取在线用户列表
func (cs *ChatService) GetOnlineUsers() ([]string, error) {
	if config.RedisClient == nil {
		return nil, errors.New("redis not available")
	}

	return config.RedisClient.SMembers(redisCtx, "online:users").Result()
}

// GetOnlineUserCount 获取在线用户数
func (cs *ChatService) GetOnlineUserCount() (int64, error) {
	if config.RedisClient == nil {
		return 0, errors.New("redis not available")
	}

	return config.RedisClient.SCard(redisCtx, "online:users").Result()
}

// ==================== Worker处理方法 ====================

// startWorkers 启动worker池
func (cs *ChatService) startWorkers() {
	// 消息处理worker
	for i := 0; i < 5; i++ { // 增加worker数量
		go cs.messageProcessor(i)
	}
}

// messageProcessor 消息处理worker
func (cs *ChatService) messageProcessor(workerID int) {
	for task := range cs.processQueue {
		cs.processAfterSend(task)
	}
}

// processMessageDirect 直接处理消息
func (cs *ChatService) processMessageDirect(task *MessageTask) (*models.Message, error) {
	// 1. 创建消息
	message := models.Message{
		ChatID:   task.ChatID,
		SenderID: task.UserID,
		Content:  task.Content,
		Type:     task.Type,
		IsRead:   false,
	}

	if err := config.DB.Create(&message).Error; err != nil {
		return nil, fmt.Errorf("failed to create message: %w", err)
	}

	// 2. 将消息处理任务放入队列
	cs.processQueue <- &MessageProcessTask{Message: &message}

	return &message, nil
}

// processAfterSend 消息发送后的处理
func (cs *ChatService) processAfterSend(task *MessageProcessTask) error {
	message := task.Message

	lastMsg := message.Content
	if message.Type == "image" {
		lastMsg = "[图片]"
	} else if message.Type == "emoji" {
		lastMsg = "[表情]"
	}

	// 1. 更新聊天的最后消息和时间
	if err := config.DB.Model(&models.Chat{}).Where("id = ?", message.ChatID).Updates(map[string]interface{}{
		"last_message": lastMsg,
		"updated_at":   time.Now(),
	}).Error; err != nil {
		return err
	}

	// 2. 获取聊天参与者
	var chatUsers []models.ChatUser
	if err := config.DB.Where("chat_id = ?", message.ChatID).Find(&chatUsers).Error; err != nil {
		return err
	}

	// 3. 增加未读计数（给接收者 - 仅当接收者不在聊天室内时）
	for _, chatUser := range chatUsers {
		if chatUser.UserID != message.SenderID {
			// 检查接收者是否在聊天室内（当前连接的WebSocket）
			// 如果用户在聊天室，则不需要增加未读数（消息会直接推送给用户）
			// 导入包会在后续处理

			// 先更新数据库未读数
			config.DB.Model(&models.ChatUser{}).
				Where("chat_id = ? AND user_id = ?", message.ChatID, chatUser.UserID).
				Update("unread_count", gorm.Expr("unread_count + 1"))

			// 更新Redis未读数
			if config.RedisClient != nil {
				unreadKey := fmt.Sprintf("unread:%s:%s", chatUser.UserID, message.ChatID)
				config.RedisClient.Incr(redisCtx, unreadKey)
				config.RedisClient.Expire(redisCtx, unreadKey, 7*24*time.Hour)
				// 若消息为交易类型，也设置未读交易标记（用于在会话列表高亮）
				if message.Type == "transaction" {
					txKey := fmt.Sprintf("unread_tx:%s:%s", chatUser.UserID, message.ChatID)
					// 保存交易消息ID或简单标记为1
					config.RedisClient.Set(redisCtx, txKey, message.ID, 7*24*time.Hour)
				}
			}
		}
	}

	// 4. 清除聊天列表缓存
	if config.RedisClient != nil {
		pattern := "chat:*"
		keys, _ := config.RedisClient.Keys(redisCtx, pattern).Result()
		for _, key := range keys {
			config.RedisClient.Del(redisCtx, key)
		}
	}

	// 5. 发布到Redis PubSub（用于WebSocket推送）
	if config.RedisClient != nil {
		// 收集接收者ID列表
		var receiverIDs []string
		for _, chatUser := range chatUsers {
			receiverIDs = append(receiverIDs, chatUser.UserID)
		}

		pubMessage := map[string]interface{}{
			"id":           message.ID,
			"type":         "message",
			"msg_type":     message.Type,
			"chat_id":      message.ChatID,
			"sender_id":    message.SenderID,
			"content":      message.Content,
			"created_at":   message.CreatedAt.Format(time.RFC3339),
			"timestamp":    message.CreatedAt.Unix(),
			"receiver_ids": receiverIDs, // 添加接收者列表
		}
		data, _ := json.Marshal(pubMessage)
		config.RedisClient.Publish(redisCtx, "chat:message", data)
	}

	return nil
}

// ==================== 辅助方法 ====================

// cacheChat 缓存聊天信息
func (cs *ChatService) cacheChat(chat *models.Chat) {
	if config.RedisClient == nil {
		return
	}

	cacheKey := fmt.Sprintf("chat:%s", chat.ID)
	data, _ := json.Marshal(chat)
	config.RedisClient.Set(redisCtx, cacheKey, data, 10*time.Minute)
}

// clearChatCaches 清除聊天相关缓存
func (cs *ChatService) clearChatCaches(chatID string) {
	if config.RedisClient == nil {
		return
	}

	keys := []string{
		fmt.Sprintf("chat:%s", chatID),
		fmt.Sprintf("chat:%s:messages:*", chatID),
	}

	for _, key := range keys {
		if keys, err := config.RedisClient.Keys(redisCtx, key).Result(); err == nil {
			for _, k := range keys {
				config.RedisClient.Del(redisCtx, k)
			}
		}
	}
}

// notifyChatCreated 通知聊天创建
func (cs *ChatService) notifyChatCreated(chat *models.Chat, initiatorID, targetUserID string) {
	if config.RedisClient == nil {
		return
	}

	// 通知目标用户
	notification := map[string]interface{}{
		"type":           "chat_created",
		"chat_id":        chat.ID,
		"initiator_id":   initiatorID,
		"target_user_id": targetUserID,
		"timestamp":      time.Now().Unix(),
	}
	data, _ := json.Marshal(notification)
	config.RedisClient.Publish(redisCtx, "chat:notification", data)
}

// cleanupOnlineUsers 清理过期在线用户
func (cs *ChatService) cleanupOnlineUsers() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		cs.onlineUsers.Range(func(key, value interface{}) bool {
			lastSeen := value.(time.Time)
			if time.Since(lastSeen) > 5*time.Minute {
				userID := key.(string)
				cs.onlineUsers.Delete(key)

				if config.RedisClient != nil {
					config.RedisClient.Del(redisCtx, "online:"+userID)
					config.RedisClient.SRem(redisCtx, "online:users", userID)
				}
			}
			return true
		})
	}
}
