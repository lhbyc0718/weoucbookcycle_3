package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"weoucbookcycle_go/config"
	"weoucbookcycle_go/middleware"
	"weoucbookcycle_go/models"
	"weoucbookcycle_go/routes"
	"weoucbookcycle_go/websocket"

	"github.com/gin-gonic/gin"
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

	// 自动迁移：必须显式开启（避免生产环境意外修改）
	enableAuto := os.Getenv("ENABLE_AUTO_MIGRATE")

	// 只有当显式开启 ENABLE_AUTO_MIGRATE=true 时才运行
	if enableAuto == "true" {
		if err := config.DB.AutoMigrate(&models.User{}, &models.Book{}, &models.Listing{}, &models.Message{}, &models.Chat{}, &models.ChatUser{}); err != nil {
			log.Printf("Warning: auto migrate failed: %v", err)
		} else {
			log.Println("✅ AutoMigrate completed")
		}
	} else {
		log.Println("AutoMigrate skipped (ENABLE_AUTO_MIGRATE != true)")
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
	r := setupRouter()

	// 注册自定义路由
	routes.SetupRoutes(r)

	// 启动服务器
	port := config.GetServerConfig().Port
	addr := ":" + port

	// If TLS cert/key provided, start HTTPS server
	certFile := os.Getenv("TLS_CERT_FILE")
	keyFile := os.Getenv("TLS_KEY_FILE")

	log.Printf("🚀 Server starting on port %s (mode=%s)", port, gin.Mode())
	log.Printf("📚 API health: http://localhost:%s/health", port)

	srv := &http.Server{
		Addr:    addr,
		Handler: r,
	}

	// Initializing the server in a goroutine so that
	// it won't block the graceful shutdown handling below
	go func() {
		var err error
		if certFile != "" && keyFile != "" {
			log.Println("Starting HTTPS server with provided TLS certificate")
			err = srv.ListenAndServeTLS(certFile, keyFile)
		} else {
			err = srv.ListenAndServe()
		}
		if err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server with
	// a timeout of 5 seconds.
	quit := make(chan os.Signal, 1)
	// kill (no param) default send syscall.SIGTERM
	// kill -2 is syscall.SIGINT
	// kill -9 is syscall.SIGKILL but can't be catch, so don't need add it
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// The context is used to inform the server it has 5 seconds to finish
	// the request it is currently handling
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown: ", err)
	}

	log.Println("Server exiting")
}

// setupRouter 设置路由
func setupRouter() *gin.Engine {
	serverConfig := config.GetServerConfig()

	// 根据环境设置Gin模式
	gin.SetMode(serverConfig.Mode)

	// 创建Gin实例
	r := gin.New()

	// 全局中间件
	r.Use(gin.Recovery())              // 恢复panic
	r.Use(middleware.Logger())         // 使用 Zap Logger
	r.Use(middleware.GzipMiddleware()) // Gzip 压缩

	// CORS配置
	if config.GetEnv("DISABLE_CORS", "false") != "true" {
		// 使用统一的中间件配置
		allowList := config.GetEnv("ALLOW_ORIGINS", "")
		var allowedOrigins []string
		if allowList != "" && allowList != "*" {
			for _, o := range strings.Split(allowList, ",") {
				allowedOrigins = append(allowedOrigins, strings.TrimSpace(o))
			}
		}

		if len(allowedOrigins) > 0 {
			r.Use(middleware.CORS(middleware.GetProductionCORSConfig(allowedOrigins)))
		} else {
			r.Use(middleware.CORS())
		}
	} else {
		log.Println("⚠️  CORS middleware disabled (DISABLE_CORS=true)")
	}

	// 打印当前环境（API 环境）以便排查
	apiEnv := config.GetEnv("API_ENV", "development")
	log.Printf("API_ENV=%s, GIN_MODE=%s", apiEnv, serverConfig.Mode)

	// 可选：如果后端也需要托管 Web 前端（默认false），可以通过环境变量开启
	if config.GetEnv("SERVE_WEB", "false") == "true" {
		webPath := config.GetEnv("WEB_DIST_PATH", "../frontend/web/dist")
		log.Printf("Serving static web files from %s", webPath)
		r.StaticFS("/", gin.Dir(webPath, false))
	}

	// 健康检查端点（包括数据库和Redis状态）
	r.GET("/health", func(c *gin.Context) {
		health := gin.H{
			"status":  "ok",
			"message": "Server is running",
		}

		// 检查数据库状态
		if config.DB != nil {
			sqlDB, err := config.DB.DB()
			if err == nil {
				if err := sqlDB.Ping(); err == nil {
					health["database"] = "connected"
				} else {
					health["database"] = "disconnected"
				}
			} else {
				health["database"] = "error"
			}
		} else {
			health["database"] = "not initialized"
		}

		// 检查Redis状态
		if config.RedisClient != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			if err := config.RedisClient.Ping(ctx).Err(); err == nil {
				health["redis"] = "connected"
			} else {
				health["redis"] = "disconnected"
			}
		} else {
			health["redis"] = "not initialized"
		}

		c.JSON(200, health)
	})

	return r
}
