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
	} // 检查是否意外启用了云开发模式
	if config.GetUseCloud() {
		log.Println("⚠️  USE_CLOUD=true 已启用，但当前后端只支持自建MySQL，请在 .env 中将其设为 false。")
	}
	// 初始化日志系统
	if err := middleware.InitLogger(env); err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer middleware.FlushLogger()

	// 验证必需的环境变量
	if err := config.ValidateRequiredEnv(); err != nil {
		log.Fatalf("环境变量验证失败: %v", err)
	}

	// 初始化数据库
	if err := config.InitDatabase(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer config.CloseDatabase()

	// 验证数据库连接
	if err := config.ValidateDatabase(config.DB); err != nil {
		log.Fatalf("数据库连接验证失败: %v", err)
	}

	// 打印启动信息
	config.PrintStartupInfo(config.GetServerConfig().Port, os.Getenv("API_BASE"), config.GetUseCloud())

	// 自动迁移：仅在非生产环境或显式开启时运行（避免生产环境意外修改）
	enableAuto := os.Getenv("ENABLE_AUTO_MIGRATE")
	ginMode := os.Getenv("GIN_MODE")
	if enableAuto == "true" || ginMode != "release" {
		if err := config.DB.AutoMigrate(&models.User{}, &models.Book{}, &models.Listing{}, &models.Message{}, &models.Chat{}); err != nil {
			log.Printf("Warning: auto migrate failed: %v", err)
		}
	} else {
		log.Println("AutoMigrate skipped (production mode)")
	}

	// 初始化Redis
	if err := config.InitializeRedis(); err != nil {
		log.Fatalf("Failed to initialize Redis: %v", err)
	}
	defer config.CloseRedis()

	// 初始化对象存储（S3/MinIO等）
	if err := config.InitializeStorage(); err != nil {
		log.Fatalf("Failed to initialize object storage: %v", err)
	}

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
	port := config.GetServerConfig().Port
	addr := ":" + port

	// If TLS cert/key provided, start HTTPS server
	certFile := os.Getenv("TLS_CERT_FILE")
	keyFile := os.Getenv("TLS_KEY_FILE")

	log.Printf("🚀 Server starting on port %s (mode=%s)", port, ginMode)
	log.Printf("📚 API health: http://localhost:%s/health", port)

	if certFile != "" && keyFile != "" {
		log.Println("Starting HTTPS server with provided TLS certificate")
		if err := r.RunTLS(addr, certFile, keyFile); err != nil {
			log.Fatalf("Failed to start HTTPS server: %v", err)
		}
	} else {
		if err := r.Run(addr); err != nil {
			log.Fatalf("Failed to start server: %v", err)
		}
	}

}
