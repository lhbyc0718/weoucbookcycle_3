package services

import (
	"log"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"
	"weoucbookcycle_go/websocket"
)

// SyncOfflineMessages 同步离线消息
// 用户重连后调用此方法，将离线期间的消息推送到客户端
func (cs *ChatService) SyncOfflineMessages(userID string) error {
	// 1. 获取用户所有聊天室的未读消息计数
	// 这里可以优化：只获取有未读消息的聊天室
	var chatUsers []models.ChatUser
	if err := config.DB.Where("user_id = ? AND unread_count > 0", userID).Find(&chatUsers).Error; err != nil {
		return err
	}

	if len(chatUsers) == 0 {
		return nil
	}

	// 2. 遍历每个有未读消息的聊天室，拉取具体消息
	for _, cu := range chatUsers {
		var messages []models.Message
		// 获取该聊天室中，发送给该用户且未读的消息
		// 注意：Message表没有 receiver_id，是通过 ChatID 关联的。
		// 逻辑：ChatID 匹配，SenderID != UserID，IsRead = false
		if err := config.DB.Where("chat_id = ? AND sender_id != ? AND is_read = ?", cu.ChatID, userID, false).
			Order("created_at ASC"). // 按时间顺序推送
			Limit(50).               // 限制每次推送数量，防止消息风暴
			Find(&messages).Error; err != nil {
			log.Printf("Failed to fetch offline messages for chat %s: %v", cu.ChatID, err)
			continue
		}

		// 3. 推送消息到 WebSocket
		for _, msg := range messages {
			wsMsg := websocket.WSMessage{
				Type:      "message",
				ChatID:    msg.ChatID,
				Content:   msg.Content,
				Timestamp: msg.CreatedAt.Unix(),
				From:      msg.SenderID,
				Data:      msg,
			}
			
			// 调用 WebSocket 层的推送逻辑
			// 注意：这里需要依赖 websocket 包的 Client 管理机制，或者通过 Redis 发布订阅通知 WebSocket 节点推送
			// 简单起见，假设是在单机或通过 Redis 广播
			if err := websocket.PushToUser(userID, wsMsg); err != nil {
				log.Printf("Failed to push offline message to user %s: %v", userID, err)
				// 推送失败不更新 IsRead，等待下次重连
				break 
			}
		}
	}

	return nil
}
