package main

import (
	"log"
	"os"

	"weoucbookcycle_go/config"
	"weoucbookcycle_go/middleware"
	"weoucbookcycle_go/models"
	"weoucbookcycle_go/routes"
	"weoucbookcycle_go/websocket"

	"github.com/joho/godotenv"
)

func main() {
	// 加载 .env 文件
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  No .env file found, using system environment variables")
	} else {
		log.Println("✅ .env file loaded successfully")
	}

	//设置环境
	env := os.Getenv("GIN_MODE")
	if env == "" {
		os.Setenv("GIN_MODE", "debug")
	}

	// 初始化日志系统
	if err := middleware.InitLogger(env); err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer middleware.FlushLogger()

	// 初始化数据库
	if err := config.InitDatabase(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer config.CloseDatabase()

	// 自动迁移：在开发环境下确保新增字段被创建（仅在开发使用）
	// 避免生产环境意外修改，请在真实部署时关闭或改用显式迁移工具
	if err := config.DB.AutoMigrate(&models.User{}, &models.Book{}, &models.Listing{}, &models.Message{}, &models.Chat{}); err != nil {
		log.Printf("Warning: auto migrate failed: %v", err)
	}

	// 初始化Redis
	if err := config.InitializeRedis(); err != nil {
		log.Fatalf("Failed to initialize Redis: %v", err)
	}
	defer config.CloseRedis()

	//初始化websocket
	if err := websocket.InitWebSocket(); err != nil {
		log.Fatalf("Failed to initialize WebSocket: %v", err)
	}
	defer websocket.CloseWebSocket()

	// 设置路由
	r := config.SetupRouter()

	// 注册自定义路由
	routes.SetupRoutes(r)

	// 启动服务器
	log.Println("🚀 Server starting on port 8080")
	log.Println("📚 API documentation: http://localhost:8080/health")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}

}
