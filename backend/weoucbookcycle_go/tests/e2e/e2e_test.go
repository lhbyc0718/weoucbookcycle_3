package e2e

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"
	"weoucbookcycle_go/routes"
	"weoucbookcycle_go/utils"
	"weoucbookcycle_go/websocket"

	"github.com/gin-gonic/gin"
	gorilla "github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"github.com/stretchr/testify/assert"
)

// SetupTestRouter 创建测试路由
func SetupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())
	// r.Use(middleware.Logger()) // Disable logger for cleaner test output

	routes.SetupRoutes(r)
	return r
}

func init() {
	// 加载配置
	// 尝试加载上级目录的 .env
	if err := godotenv.Load("../../.env"); err != nil {
		log.Println("⚠️  No .env file found in ../../, trying default locations")
		godotenv.Load()
	}

	// Ensure JWT_SECRET is set for tests
	if os.Getenv("JWT_SECRET") == "" {
		os.Setenv("JWT_SECRET", "test_secret_key_for_e2e")
	}

	config.InitDatabase()
	config.InitializeRedis()
	websocket.InitWebSocket()
}

// CreateTestUser 创建测试用户并返回Token
func CreateTestUser(r *gin.Engine, username string) (string, string, error) {
	// 1. 注册/登录
	// 为了简化，我们直接在数据库创建用户并生成Token
	user := models.User{
		Username:     username,
		Email:        username + "@example.com",
		WeChatOpenID: func() *string { s := "test_openid_" + username; return &s }(),
		Avatar:       "http://example.com/avatar.jpg",
	}

	// 检查是否存在
	var existing models.User
	if err := config.DB.Where("username = ?", username).First(&existing).Error; err == nil {
		user = existing
	} else {
		user.ID = utils.GenerateUUID()
		if err := config.DB.Create(&user).Error; err != nil {
			return "", "", err
		}
	}

	// 生成Token
	jwtService := config.GetJWTService()
	token, err := jwtService.GenerateToken(user.ID, user.Username, user.Email, []string{"user"})
	if err != nil {
		return "", "", err
	}

	return user.ID, token, nil
}

func TestWebSocketAuthAndMessageFlow(t *testing.T) {
	router := SetupTestRouter()
	server := httptest.NewServer(router)
	defer server.Close()

	// 1. 创建两个用户
	userID1, token1, err := CreateTestUser(router, "user1")
	assert.NoError(t, err)
	userID2, token2, err := CreateTestUser(router, "user2")
	assert.NoError(t, err)

	log.Printf("User1: %s, User2: %s", userID1, userID2)

	// 2. 建立 WebSocket 连接
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

	// Case 2.1: 无 Token 连接 -> 应该失败
	_, _, err = gorilla.DefaultDialer.Dial(wsURL, nil)
	assert.Error(t, err, "Should fail without token")

	// Case 2.2: User 1 使用 Query Token 连接 (模拟小程序)
	wsURL1 := fmt.Sprintf("%s?token=%s", wsURL, token1)
	ws1, _, err := gorilla.DefaultDialer.Dial(wsURL1, nil)
	assert.NoError(t, err, "User 1 should connect with token param")
	defer ws1.Close()

	// Case 2.3: User 2 使用 Cookie Token 连接 (模拟 Web)
	header := http.Header{}
	header.Add("Cookie", fmt.Sprintf("jwt_token=%s", token2))
	// 注意：Web端也会尝试带 ?token=xxx，但也支持 Cookie 兜底
	// 这里测试纯 Cookie 兜底能力
	// 但我们的实现中，优先读 Query，如果 Query 没有，则读 Cookie
	// 所以这里 URL 不带 token
	ws2, _, err := gorilla.DefaultDialer.Dial(wsURL, header)
	assert.NoError(t, err, "User 2 should connect with cookie")
	defer ws2.Close()

	// 3. 创建聊天室 (User 1 -> User 2)
	// 使用 HTTP Client 模拟 API 调用
	client := &http.Client{}
	createChatBody := fmt.Sprintf(`{"user_id": "%s"}`, userID2)
	req, _ := http.NewRequest("POST", server.URL+"/api/chats", strings.NewReader(createChatBody))
	req.Header.Set("Authorization", "Bearer "+token1)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	assert.NoError(t, err)

	if resp.StatusCode != http.StatusOK {
		var errResp map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errResp)
		log.Printf("❌ Create Chat Failed: Status=%d, Body=%v", resp.StatusCode, errResp)
		t.FailNow()
	}
	assert.Equal(t, http.StatusOK, resp.StatusCode) // 或者是 201 Created

	var chatResp struct {
		Code int `json:"code"`
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&chatResp)
	chatID := chatResp.Data.ID
	assert.NotEmpty(t, chatID)
	log.Printf("Chat Created: %s", chatID)

	// User 2 加入聊天室 (发送 join_chat)
	joinMsg := map[string]string{
		"type":    "join_chat",
		"chat_id": chatID,
	}
	err = ws2.WriteJSON(joinMsg)
	assert.NoError(t, err)
	// Give it a moment to process join
	time.Sleep(100 * time.Millisecond)

	// 4. 发送消息 (User 1 via API)
	msgContent := "Hello User 2 via API"
	sendMsgBody := fmt.Sprintf(`{"content": "%s"}`, msgContent)
	req, _ = http.NewRequest("POST", fmt.Sprintf("%s/api/chats/%s/messages", server.URL, chatID), strings.NewReader(sendMsgBody))
	req.Header.Set("Authorization", "Bearer "+token1)
	req.Header.Set("Content-Type", "application/json")

	// 在 User 2 监听 WebSocket 消息
	done := make(chan bool)
	go func() {
		for {
			_, message, err := ws2.ReadMessage()
			if err != nil {
				log.Printf("User 2 WS Error: %v", err)
				return
			}

			var msgData map[string]interface{}
			json.Unmarshal(message, &msgData)

			// 检查是否是刚发的消息
			if msgData["type"] == "message" {
				if content, ok := msgData["content"].(string); ok && content == msgContent {
					log.Println("✅ User 2 received message via WebSocket")
					done <- true
					return
				}
			}
		}
	}()

	// 发送消息请求
	resp, err = client.Do(req)
	assert.NoError(t, err)
	assert.True(t, resp.StatusCode == 201 || resp.StatusCode == 202)

	// 等待接收 (超时 5s)
	select {
	case <-done:
		// Success
	case <-time.After(5 * time.Second):
		t.Fatal("User 2 did not receive message via WebSocket within timeout")
	}
}
