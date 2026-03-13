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
	"weoucbookcycle_go/services"
	"weoucbookcycle_go/utils"
	"weoucbookcycle_go/websocket"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
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
	enableAuto := config.GetEnv("ENABLE_AUTO_MIGRATE", "true") // 默认改为 true，方便开发

	// 只有当显式开启 ENABLE_AUTO_MIGRATE=true 时才运行
	if enableAuto == "true" {
		if err := config.DB.AutoMigrate(
			&models.User{},
			&models.Book{},
			&models.Listing{},
			&models.Message{},
			&models.Chat{},
			&models.ChatUser{},
			&models.Transaction{}, // 新增
			&models.Notification{},
			&models.Report{},
			&models.Order{},    // 新增
			&models.Wishlist{}, // 新增
			&models.Address{},
			&models.Block{},
		); err != nil {
			log.Printf("Warning: auto migrate failed: %v", err)
		} else {
			log.Println("✅ AutoMigrate completed")
			// 迁移成功后尝试插入一些默认官方地址（幂等）
			seedDefaultAddresses()
		}
	} else {
		log.Println("AutoMigrate skipped (ENABLE_AUTO_MIGRATE != true)")
	}

	// 确保存在默认管理员账号（幂等）
	ensureDefaultAdmin()

	// 初始化Redis
	if err := config.InitializeRedis(); err != nil {
		log.Fatalf("Failed to initialize Redis: %v", err)
	}
	defer config.CloseRedis()

	// 确保 books 表包含 address_id 列（向后兼容）
	ensureBookAddressColumn()

	// 确保 transactions 表包含 rating 相关列
	ensureTransactionRatingColumns()

	// 初始化对象存储（S3/MinIO等）
	if err := config.InitializeStorage(); err != nil {
		log.Fatalf("Failed to initialize object storage: %v", err)
	}

	// 初始化Elasticsearch
	if err := config.InitializeElastic(); err != nil {
		log.Printf("⚠️  Failed to initialize Elasticsearch: %v", err)
		// 不强制退出，允许降级到普通搜索
	} else {
		log.Println("✅ Elasticsearch initialized successfully")
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

	// 启动数据一致性检查任务
	monitorService := services.NewMonitorService()
	monitorService.StartConsistencyCheck()

	// 启动服务器
	port := config.GetServerConfig().Port
	addr := ":" + port

	// If TLS cert/key provided, start HTTPS server
	certFile := os.Getenv("TLS_CERT_FILE")
	keyFile := os.Getenv("TLS_KEY_FILE")

	// 强制HTTPS重定向中间件
	if certFile != "" && keyFile != "" {
		r.Use(func(c *gin.Context) {
			if c.Request.TLS == nil && c.Request.Header.Get("X-Forwarded-Proto") != "https" {
				target := "https://" + c.Request.Host + c.Request.URL.Path
				if len(c.Request.URL.RawQuery) > 0 {
					target += "?" + c.Request.URL.RawQuery
				}
				c.Redirect(http.StatusMovedPermanently, target)
				c.Abort()
				return
			}
			c.Next()
		})
	}

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
	// r.Run() is intentionally omitted here; server lifecycle is managed by the
	// http.Server above and graceful shutdown has already completed.  Calling
	// r.Run() again would attempt to listen on the same port and immediately
	// fail or restart unexpectedly.
}

// seedDefaultAddresses 插入默认官方地址（幂等）
func seedDefaultAddresses() {
	defaults := []models.Address{
		{Province: "福建省", City: "厦门市", District: "思明区", Address: "海大北海苑四号楼", Official: true, IsActive: true},
		{Province: "福建省", City: "厦门市", District: "思明区", Address: "海大东海苑六号楼", Official: true, IsActive: true},
	}

	for _, a := range defaults {
		var cnt int64
		config.DB.Model(&models.Address{}).Where("province = ? AND city = ? AND address LIKE ? AND official = ?", a.Province, a.City, "%"+a.Address+"%", true).Count(&cnt)
		if cnt == 0 {
			if err := config.DB.Create(&a).Error; err != nil {
				log.Printf("Failed to seed address %s: %v", a.Address, err)
			} else {
				log.Printf("Seeded default address: %s", a.Address)
			}
		}
	}
}

// ensureBookAddressColumn 检查并在 books 表添加 address_id 列（幂等）
func ensureBookAddressColumn() {
	// 使用 GORM migrator 检查字段是否存在
	if config.DB == nil {
		log.Println("DB not initialized, skipping ensureBookAddressColumn")
		return
	}

	// GORM 的 HasColumn 使用结构体字段名
	has := config.DB.Migrator().HasColumn(&models.Book{}, "AddressID")
	if has {
		log.Println("books.address_id column exists")
		return
	}

	// 尝试添加列，使用结构字段名 AddressID
	if err := config.DB.Migrator().AddColumn(&models.Book{}, "AddressID"); err != nil {
		log.Printf("Failed to add books.address_id column: %v", err)
	} else {
		log.Println("Added books.address_id column successfully")
	}
}

// ensureTransactionRatingColumns 检查并在 transactions 表添加 rating, review, is_reviewed 列（幂等）
func ensureTransactionRatingColumns() {
	if config.DB == nil {
		return
	}

	migrator := config.DB.Migrator()

	// 检查并添加 rating 列
	if !migrator.HasColumn(&models.Transaction{}, "Rating") {
		if err := migrator.AddColumn(&models.Transaction{}, "Rating"); err != nil {
			log.Printf("Failed to add transactions.rating column: %v", err)
		} else {
			log.Println("Added transactions.rating column successfully")
		}
	}

	// 检查并添加 review 列
	if !migrator.HasColumn(&models.Transaction{}, "Review") {
		if err := migrator.AddColumn(&models.Transaction{}, "Review"); err != nil {
			log.Printf("Failed to add transactions.review column: %v", err)
		} else {
			log.Println("Added transactions.review column successfully")
		}
	}

	// 检查并添加 is_reviewed 列
	if !migrator.HasColumn(&models.Transaction{}, "IsReviewed") {
		if err := migrator.AddColumn(&models.Transaction{}, "IsReviewed"); err != nil {
			log.Printf("Failed to add transactions.is_reviewed column: %v", err)
		} else {
			log.Println("Added transactions.is_reviewed column successfully")
		}
	}
}

// ensureDefaultAdmin 保证存在一个初始管理员（幂等）
func ensureDefaultAdmin() {
	if config.DB == nil {
		log.Println("DB not initialized, skipping ensureDefaultAdmin")
		return
	}

	username := config.GetEnv("ADMIN_USERNAME", "lyctzy")
	password := config.GetEnv("ADMIN_PASSWORD", "A925179079b")
	email := config.GetEnv("ADMIN_EMAIL", username+"@local")

	var existing models.User
	if err := config.DB.Where("username = ? OR email = ?", username, email).First(&existing).Error; err == nil {
		log.Printf("Admin user exists: %s (username=%s)", existing.Email, existing.Username)
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("failed to hash admin password: %v", err)
		return
	}

	now := time.Now()
	u := models.User{
		ID:            utils.GenerateUUID(),
		Username:      username,
		Email:         email,
		Password:      string(hashed),
		Role:          "admin",
		TrustScore:    100,
		EmailVerified: true,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := config.DB.Create(&u).Error; err != nil {
		log.Printf("failed to create default admin: %v", err)
	} else {
		log.Printf("Created default admin: %s (username=%s)", email, username)
	}
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

	// 提供 /admin/login（通过通配符处理）并将所有 /admin 前缀请求重定向到 /admin/login
	r.GET("/admin", func(c *gin.Context) {
		c.Redirect(http.StatusFound, "/admin/login")
		c.Abort()
	})

	// 使用单个通配符路由处理 /admin/*，避免 static vs wildcard 路由冲突
	r.GET("/admin/*any", func(c *gin.Context) {
		any := c.Param("any") // 包含前导 '/'
		// 如果访问 /admin/login，则将其映射到前端实际登录页 /login
		if any == "/login" || any == "/login/" {
			c.Redirect(http.StatusFound, "/login")
			c.Abort()
			return
		}
		// 其他 /admin/* 路径统一跳转到 /admin/login
		c.Redirect(http.StatusFound, "/admin/login")
		c.Abort()
	})

	return r
}
