package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
	"weoucbookcycle_go/config"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

var (
	// 升级器 - 将HTTP连接升级为WebSocket连接
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			// 从环境变量读取允许的域名
			allowedOrigins := strings.Split(config.GetEnv("WS_ALLOWED_ORIGINS", "*"), ",")
			origin := r.Header.Get("Origin")
			if origin == "" {
				return true // 允许没有Origin的请求（如移动应用）
			}

			for _, allowed := range allowedOrigins {
				if strings.TrimSpace(allowed) == "*" {
					return true
				}
				if strings.TrimSpace(allowed) == origin {
					return true
				}
			}
			return false
		},
	}

	// 客户端连接管理
	clients      = make(map[string]*Client) // userID -> Client
	clientsMutex sync.RWMutex

	// 聊天室管理
	chatRooms      = make(map[string]*ChatRoom) // chatID -> ChatRoom
	chatRoomsMutex sync.RWMutex

	// 消息广播队列
	broadcastQueue = make(chan *BroadcastMessage, 1000)

	// Redis订阅
	redisPubSub *redis.PubSub
	redisCtx    = context.Background()
)

// Client WebSocket客户端
type Client struct {
	ID         string          // 用户ID
	Connection *websocket.Conn // WebSocket连接
	Send       chan *WSMessage // 发送消息队列
	ChatRooms  map[string]bool // 用户所在的聊天室
	mu         sync.Mutex      // 客户端锁
}

// WSMessage WebSocket消息结构
type WSMessage struct {
	Type      string      `json:"type"` // 消息类型: message, typing, read, ping, pong
	ChatID    string      `json:"chat_id,omitempty"`
	Content   string      `json:"content,omitempty"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp int64       `json:"timestamp"`
	From      string      `json:"from,omitempty"`
}

// ChatRoom 聊天室
type ChatRoom struct {
	ID      string
	Clients map[string]*Client // chatID -> list of clients
	mu      sync.RWMutex
}

// BroadcastMessage 广播消息
type BroadcastMessage struct {
	Type   string      `json:"type"`
	ChatID string      `json:"chat_id"`
	Data   interface{} `json:"data"`
}

// InitWebSocket 初始化WebSocket服务
func InitWebSocket() error {
	// 启动广播worker
	go startBroadcastWorker()

	// 启动Redis PubSub监听（用于多服务器场景）
	if config.RedisClient != nil {
		go subscribeToRedis()
	}

	log.Println("✅ WebSocket service initialized")
	return nil
}

// HandleConnection 处理WebSocket连接
func HandleConnection(c *gin.Context) {
	token := c.Query("token")
	// Web 端可通过 HttpOnly Cookie 自动携带，这里做兜底读取
	if token == "" {
		if cookieToken, err := c.Cookie("jwt_token"); err == nil {
			token = cookieToken
		}
	}
	var userID string

	// 如果提供了token，验证token获取userID
	if token != "" {
		jwtService := config.GetJWTService()
		claims, err := jwtService.ValidateToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}
		userID = claims.UserID
	} else {
		// 兼容旧逻辑（如果允许非认证连接），或直接报错
		// 这里为了安全，强制要求token
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token is required"})
		return
	}

	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID not found in token"})
		return
	}

	// 升级HTTP连接为WebSocket连接
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	// 创建客户端
	client := &Client{
		ID:         userID,
		Connection: conn,
		Send:       make(chan *WSMessage, 256),
		ChatRooms:  make(map[string]bool),
	}

	// 添加到客户端列表
	clientsMutex.Lock()
	clients[userID] = client
	clientsMutex.Unlock()

	// 设置用户在线状态到Redis
	if config.RedisClient != nil {
		go func() {
			config.RedisClient.Set(redisCtx, "online:"+userID, "1", time.Minute*5)
			config.RedisClient.SAdd(redisCtx, "online:users", userID)
		}()
	}

	log.Printf("User %s connected via WebSocket", userID)

	// 启动读写goroutine
	go client.readPump()
	go client.writePump()

	// 发送未读消息
	go client.sendUnreadMessages()
}

// readPump 从WebSocket连接读取消息
func (c *Client) readPump() {
	defer func() {
		// 清理连接
		log.Printf("Closing connection for user %s", c.ID)

		// 从所有聊天室移除
		c.mu.Lock()
		for chatID := range c.ChatRooms {
			if room, exists := getChatRoom(chatID); exists {
				room.mu.Lock()
				delete(room.Clients, c.ID)
				room.mu.Unlock()
			}
		}
		c.mu.Unlock()

		// 从客户端列表移除
		clientsMutex.Lock()
		delete(clients, c.ID)
		clientsMutex.Unlock()

		// 更新Redis在线状态
		if config.RedisClient != nil {
			config.RedisClient.Del(redisCtx, "online:"+c.ID)
			config.RedisClient.SRem(redisCtx, "online:users", c.ID)
		}

		c.Connection.Close()
	}()

	// 设置读超时
	c.Connection.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Connection.SetPongHandler(func(string) error {
		c.Connection.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Connection.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error for user %s: %v", c.ID, err)
			}
			break
		}

		// 解析消息
		var wsMessage WSMessage
		if err := json.Unmarshal(message, &wsMessage); err != nil {
			log.Printf("Failed to unmarshal message: %v", err)
			continue
		}

		// 设置时间戳
		wsMessage.Timestamp = time.Now().Unix()
		wsMessage.From = c.ID

		// 处理消息
		c.handleMessage(&wsMessage)
	}
}

// writePump 向WebSocket连接写入消息
func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.Connection.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				// 通道关闭
				c.Connection.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			c.Connection.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Connection.WriteJSON(message); err != nil {
				log.Printf("WebSocket write error for user %s: %v", c.ID, err)
				return
			}

		case <-ticker.C:
			// 发送心跳
			c.Connection.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Connection.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage 处理接收到的消息
func (c *Client) handleMessage(message *WSMessage) {
	switch message.Type {
	case "message":
		// 聊天消息
		c.handleChatMessage(message)

	case "typing":
		// 正在输入
		c.handleTypingMessage(message)

	case "read":
		// 消息已读
		c.handleReadMessage(message)

	case "join_chat":
		// 加入聊天室
		c.handleJoinChat(message)

	case "leave_chat":
		// 离开聊天室
		c.handleLeaveChat(message)

	case "ping":
		// 心跳响应
		c.Send <- &WSMessage{
			Type:      "pong",
			Timestamp: time.Now().Unix(),
		}

	default:
		log.Printf("Unknown message type: %s", message.Type)
	}
}

// handleChatMessage 处理聊天消息
func (c *Client) handleChatMessage(message *WSMessage) {
	if message.ChatID == "" || message.Content == "" {
		return
	}

	// 广播消息到聊天室
	broadcastMessage := &BroadcastMessage{
		Type:   "message",
		ChatID: message.ChatID,
		Data:   message,
	}

	// 放入广播队列
	select {
	case broadcastQueue <- broadcastMessage:
		// 成功放入队列
	default:
		log.Printf("Broadcast queue is full, dropping message")
	}

	// 同时发布到Redis（用于多服务器同步）
	if config.RedisClient != nil {
		go func() {
			data, _ := json.Marshal(broadcastMessage)
			config.RedisClient.Publish(redisCtx, "chat:broadcast", data)
		}()
	}
}

// handleTypingMessage 处理正在输入消息
func (c *Client) handleTypingMessage(message *WSMessage) {
	if message.ChatID == "" {
		return
	}

	// 广播正在输入状态
	broadcastMessage := &BroadcastMessage{
		Type:   "typing",
		ChatID: message.ChatID,
		Data: gin.H{
			"user_id":   c.ID,
			"typing":    true,
			"timestamp": time.Now().Unix(),
		},
	}

	select {
	case broadcastQueue <- broadcastMessage:
	default:
	}
}

// handleReadMessage 处理已读消息
func (c *Client) handleReadMessage(message *WSMessage) {
	if message.ChatID == "" {
		return
	}

	// 清除Redis中的未读计数
	if config.RedisClient != nil {
		go func() {
			config.RedisClient.Del(redisCtx, "unread:"+c.ID+":"+message.ChatID)
		}()
	}

	// 广播已读状态
	broadcastMessage := &BroadcastMessage{
		Type:   "read",
		ChatID: message.ChatID,
		Data: gin.H{
			"user_id":   c.ID,
			"timestamp": time.Now().Unix(),
		},
	}

	select {
	case broadcastQueue <- broadcastMessage:
	default:
	}
}

// handleJoinChat 处理加入聊天室
func (c *Client) handleJoinChat(message *WSMessage) {
	if message.ChatID == "" {
		return
	}

	// 获取或创建聊天室
	chatRoom := getOrCreateChatRoom(message.ChatID)

	// 将客户端添加到聊天室
	chatRoom.mu.Lock()
	chatRoom.Clients[c.ID] = c
	chatRoom.mu.Unlock()

	// 记录客户端加入的聊天室
	c.mu.Lock()
	c.ChatRooms[message.ChatID] = true
	c.mu.Unlock()

	log.Printf("User %s joined chat room %s", c.ID, message.ChatID)
}

// handleLeaveChat 处理离开聊天室
func (c *Client) handleLeaveChat(message *WSMessage) {
	if message.ChatID == "" {
		return
	}

	// 从聊天室移除客户端
	if chatRoom, exists := getChatRoom(message.ChatID); exists {
		chatRoom.mu.Lock()
		delete(chatRoom.Clients, c.ID)
		chatRoom.mu.Unlock()
	}

	// 从客户端记录中移除聊天室
	c.mu.Lock()
	delete(c.ChatRooms, message.ChatID)
	c.mu.Unlock()

	log.Printf("User %s left chat room %s", c.ID, message.ChatID)
}

// startBroadcastWorker 启动广播worker
func startBroadcastWorker() {
	for broadcast := range broadcastQueue {
		processBroadcast(broadcast)
	}
}

// processBroadcast 处理单个广播消息
func processBroadcast(broadcast *BroadcastMessage) {
	chatRoom, exists := getChatRoom(broadcast.ChatID)
	if !exists {
		return
	}

	// 向聊天室中的所有客户端广播消息
	chatRoom.mu.RLock()
	defer chatRoom.mu.RUnlock()

	var wg sync.WaitGroup
	for _, client := range chatRoom.Clients {
		wg.Add(1)
		go func(c *Client, data interface{}) {
			defer wg.Done()

			var msg *WSMessage
			if wsMsg, ok := data.(WSMessage); ok {
				msg = &wsMsg
			} else if wsMsgPtr, ok := data.(*WSMessage); ok {
				msg = wsMsgPtr
			} else {
				msg = &WSMessage{
					Type:      broadcast.Type,
					ChatID:    broadcast.ChatID,
					Data:      data,
					Timestamp: time.Now().Unix(),
				}
			}

			select {
			case c.Send <- msg:
			default:
				// 发送队列满了，断开连接
				log.Printf("Client %s send queue is full, closing connection", c.ID)
				c.Connection.Close()
			}
		}(client, broadcast.Data)
	}
	wg.Wait()
}

// getOrCreateChatRoom 获取或创建聊天室
func getOrCreateChatRoom(chatID string) *ChatRoom {
	chatRoomsMutex.RLock()
	room, exists := chatRooms[chatID]
	chatRoomsMutex.RUnlock()

	if !exists {
		chatRoomsMutex.Lock()
		room, exists = chatRooms[chatID]
		if !exists {
			room = &ChatRoom{
				ID:      chatID,
				Clients: make(map[string]*Client),
			}
			chatRooms[chatID] = room
		}
		chatRoomsMutex.Unlock()
	}

	return room
}

// getChatRoom 获取聊天室
func getChatRoom(chatID string) (*ChatRoom, bool) {
	chatRoomsMutex.RLock()
	defer chatRoomsMutex.RUnlock()
	room, exists := chatRooms[chatID]
	return room, exists
}

// subscribeToRedis 订阅Redis频道（多服务器同步）
func subscribeToRedis() {
	pubsub := config.RedisClient.Subscribe(redisCtx, "chat:broadcast")
	redisPubSub = pubsub

	ch := pubsub.Channel()
	for msg := range ch {
		var broadcast BroadcastMessage
		if err := json.Unmarshal([]byte(msg.Payload), &broadcast); err != nil {
			continue
		}

		// 将Redis消息放入本地广播队列
		select {
		case broadcastQueue <- &broadcast:
		default:
		}
	}
}

// sendUnreadMessages 发送未读消息
func (c *Client) sendUnreadMessages() {
	if config.RedisClient == nil {
		return
	}

	// 获取用户所有聊天室的未读消息
	pattern := "unread:" + c.ID + ":*"
	keys, _ := config.RedisClient.Keys(redisCtx, pattern).Result()

	for _, key := range keys {
		// 提取chatID
		chatID := key[len("unread:"+c.ID+":"):]

		// 获取缓存的消息
		cacheKey := "chat:" + chatID + ":last_messages"
		cachedMessages, err := config.RedisClient.LRange(redisCtx, cacheKey, 0, -1).Result()
		if err != nil {
			continue
		}

		// 发送缓存的消息
		for _, msgStr := range cachedMessages {
			var message WSMessage
			if err := json.Unmarshal([]byte(msgStr), &message); err == nil {
				select {
				case c.Send <- &message:
				default:
				}
			}
		}
	}
}

// GetOnlineUsers 获取在线用户列表
func GetOnlineUsers() ([]string, error) {
	if config.RedisClient == nil {
		return nil, fmt.Errorf("redis not available")
	}

	return config.RedisClient.SMembers(redisCtx, "online:users").Result()
}

// GetOnlineUserCount 获取在线用户数
func GetOnlineUserCount() (int64, error) {
	if config.RedisClient == nil {
		return 0, fmt.Errorf("redis not available")
	}

	return config.RedisClient.SCard(redisCtx, "online:users").Result()
}

// BroadcastToAll 广播消息给所有在线用户
func BroadcastToAll(messageType string, data interface{}) error {
	clientsMutex.RLock()
	defer clientsMutex.RUnlock()

	var wg sync.WaitGroup
	for _, client := range clients {
		wg.Add(1)
		go func(c *Client) {
			defer wg.Done()
			select {
			case c.Send <- &WSMessage{
				Type:      messageType,
				Data:      data,
				Timestamp: time.Now().Unix(),
			}:
			default:
			}
		}(client)
	}
	wg.Wait()

	return nil
}

// BroadcastToChat 广播消息给指定聊天室
func BroadcastToChat(chatID string, messageType string, data interface{}) error {
	// 构造广播消息
	broadcastMessage := &BroadcastMessage{
		Type:   messageType,
		ChatID: chatID,
		Data:   data,
	}

	// 放入广播队列
	select {
	case broadcastQueue <- broadcastMessage:
		// 成功放入队列
	default:
		return fmt.Errorf("broadcast queue is full")
	}

	// 同时发布到Redis（用于多服务器同步）
	if config.RedisClient != nil {
		go func() {
			payload, _ := json.Marshal(broadcastMessage)
			config.RedisClient.Publish(redisCtx, "chat:broadcast", payload)
		}()
	}

	return nil
}

// CloseWebSocket 关闭WebSocket服务
func CloseWebSocket() {
	if redisPubSub != nil {
		redisPubSub.Close()
	}

	clientsMutex.Lock()
	for _, client := range clients {
		client.Connection.Close()
	}
	clientsMutex.Unlock()
}
