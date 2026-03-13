package routes

import (
	"os"
	"weoucbookcycle_go/controllers"
	"weoucbookcycle_go/middleware"
	"weoucbookcycle_go/websocket"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// SetupRoutes 设置路由
func SetupRoutes(r *gin.Engine) {
	// Note: CORS, Logger, and Recovery middleware are already applied in config/server.go:SetupRouter()
	// Do NOT apply them again here to avoid duplication and conflicts

	// API 路由组
	// 使用速率限制中间件
	// 添加安全头中间件
	api := r.Group("/api", middleware.RateLimitMiddleware(), middleware.SecurityHeadersMiddleware())

	// 简单的 CSRF 保护 (Origin Check)
	// 在生产环境中，allowedOrigins 应该从配置中读取
	allowedOrigins := []string{
		"http://localhost:3000",
		"http://localhost:5173",
		"http://localhost:4173",
		os.Getenv("FRONTEND_URL"), // 支持环境变量配置
	}

	// ====== 交易路由 ======
	transactions := api.Group("/transactions")
	{
		transactions.GET("/:id", middleware.AuthMiddleware(), controllers.NewTransactionController().GetTransaction)
		transactions.POST("", middleware.AuthMiddleware(), controllers.NewTransactionController().CreateTransaction)
		transactions.GET("/unread", middleware.AuthMiddleware(), controllers.NewTransactionController().GetUnread)
		transactions.GET("/mine", middleware.AuthMiddleware(), controllers.NewTransactionController().GetMyTransactions)
		// 清除交易未读标记
		transactions.POST("/unread/clear", middleware.AuthMiddleware(), controllers.NewTransactionController().ClearUnread)
		transactions.PUT("/:id/confirm", middleware.AuthMiddleware(), controllers.NewTransactionController().ConfirmBySeller)
		transactions.PUT("/:id/receive", middleware.AuthMiddleware(), controllers.NewTransactionController().ConfirmReceipt)
		transactions.PUT("/:id/cancel", middleware.AuthMiddleware(), controllers.NewTransactionController().CancelTransaction)
		transactions.POST("/:id/review", middleware.AuthMiddleware(), controllers.NewTransactionController().ReviewTransaction) // 新增评价接口
	}
	api.Use(middleware.CSRFMiddleware(allowedOrigins))

	// ====== 静态文件服务 ======
	// 服务上传的图片文件
	r.Static("/uploads", "./uploads")

	{
		// ====== 认证路由 (无需认证) ======
		auth := api.Group("/auth")
		{
			auth.GET("/captcha", controllers.NewAuthController().GetCaptcha)
			auth.POST("/register", controllers.NewAuthController().Register)
			auth.POST("/complete-registration", controllers.NewAuthController().CompleteRegistration)
			auth.POST("/login", controllers.NewAuthController().Login)
			// 微信小程序登录，无需邮箱密码
			auth.POST("/wechat", controllers.NewAuthController().WeChatLogin)
			auth.POST("/refresh", controllers.NewAuthController().RefreshToken)
			auth.POST("/logout", controllers.NewAuthController().Logout)
			auth.POST("/verify-email", controllers.NewAuthController().VerifyEmail)
			auth.POST("/resend-verification", controllers.NewAuthController().ResendVerificationCode)
			auth.POST("/send-password-reset", controllers.NewAuthController().SendPasswordResetToken)
			auth.POST("/reset-password", controllers.NewAuthController().ResetPassword)
			auth.POST("/update-password", middleware.AuthMiddleware(), controllers.NewAuthController().UpdatePassword)
		}

		// ====== 上传路由 ======
		api.POST("/upload", middleware.AuthMiddleware(), controllers.NewUploadController().UploadFile)

		// ====== 用户路由 ======
		users := api.Group("/users")
		{
			users.POST(":id/block", middleware.AuthMiddleware(), controllers.NewUserController().BlockUser)
			users.POST(":id/unblock", middleware.AuthMiddleware(), controllers.NewUserController().UnblockUser)
			users.GET("/me", middleware.AuthMiddleware(), controllers.NewUserController().GetMyProfile)
			users.GET("/active", controllers.NewUserController().GetActiveUsers)
			users.GET("/online", controllers.NewUserController().GetOnlineUsers)
			users.GET("/:id", controllers.NewUserController().GetUserProfile)
			users.PUT("/profile", middleware.AuthMiddleware(), controllers.NewUserController().UpdateUserProfile)
			users.POST("/wishlist/toggle", middleware.AuthMiddleware(), controllers.NewUserController().ToggleWishlist)
		}

		// ====== 书籍路由 ======
		books := api.Group("/books")
		{
			books.GET("", middleware.OptionalAuthMiddleware(), controllers.NewBookController().GetBooks)
			books.GET("/hot", middleware.OptionalAuthMiddleware(), controllers.NewBookController().GetHotBooks)
			books.GET("/search", middleware.OptionalAuthMiddleware(), controllers.NewBookController().SearchBooks)
			books.GET("/recommendations", middleware.AuthMiddleware(), controllers.NewBookController().GetRecommendations)
			books.GET("/:id", middleware.OptionalAuthMiddleware(), controllers.NewBookController().GetBook)
			books.POST("", middleware.AuthMiddleware(), controllers.NewBookController().CreateBook)
			books.PUT("/:id", middleware.AuthMiddleware(), controllers.NewBookController().UpdateBook)
			books.DELETE("/:id", middleware.AuthMiddleware(), controllers.NewBookController().DeleteBook)
			books.POST("/:id/like", middleware.AuthMiddleware(), controllers.NewBookController().LikeBook)
		}

		// ====== 地址路由 ======
		addresses := api.Group("/addresses")
		{
			addresses.GET("", controllers.NewAddressController().GetAddresses)
			addresses.POST("", middleware.AuthMiddleware(), controllers.NewAddressController().CreateAddress)
			addresses.DELETE("/:id", middleware.AuthMiddleware(), controllers.NewAddressController().DeleteAddress)
			// 用户自定义地址
			addresses.GET("/user/custom", middleware.AuthMiddleware(), controllers.NewAddressController().GetUserAddresses)
			addresses.POST("/user/custom", middleware.AuthMiddleware(), controllers.NewAddressController().CreateUserAddress)
			addresses.DELETE("/user/custom/:id", middleware.AuthMiddleware(), controllers.NewAddressController().DeleteUserAddress)
		}

		// ====== 发布路由 ======
		listings := api.Group("/listings")
		{
			listings.GET("", controllers.NewListingController().GetListings)
			listings.GET("/mine", middleware.AuthMiddleware(), controllers.NewListingController().GetMyListings)
			listings.GET("/:id", controllers.NewListingController().GetListing)
			listings.POST("", middleware.AuthMiddleware(), controllers.NewListingController().CreateListing)
			listings.PUT("/:id/status", middleware.AuthMiddleware(), controllers.NewListingController().UpdateListingStatus)
			listings.POST("/:id/favorite", middleware.AuthMiddleware(), controllers.NewListingController().FavoriteListing)
		}

		// ====== 聊天路由 ======
		chats := api.Group("/chats")
		{
			chats.GET("", middleware.AuthMiddleware(), controllers.NewChatController().GetChats)
			chats.GET("/unread", middleware.AuthMiddleware(), controllers.NewChatController().GetUnreadCount)
			chats.GET("/online-users", middleware.AuthMiddleware(), controllers.NewChatController().GetOnlineUsers)
			chats.GET("/:id", middleware.AuthMiddleware(), controllers.NewChatController().GetChat)
			chats.GET("/:id/messages", middleware.AuthMiddleware(), controllers.NewChatController().GetMessages)
			chats.POST("", middleware.AuthMiddleware(), controllers.NewChatController().CreateChat)
			chats.POST("/:id/messages", middleware.AuthMiddleware(), controllers.NewChatController().SendMessage)
			chats.PUT("/:id/read", middleware.AuthMiddleware(), controllers.NewChatController().MarkAsRead)
			chats.DELETE("/:id", middleware.AuthMiddleware(), controllers.NewChatController().DeleteChat)
			chats.DELETE("/:id/messages", middleware.AuthMiddleware(), controllers.NewChatController().ClearMessagesHandler)
		}

		// ====== 通知路由 ======
		notifications := api.Group("/notifications")
		{
			notifications.GET("", middleware.AuthMiddleware(), controllers.NewNotificationController().ListNotifications)
			notifications.GET("/unread", middleware.AuthMiddleware(), controllers.NewNotificationController().GetUnreadCount)
			notifications.POST("/:id/read", middleware.AuthMiddleware(), controllers.NewNotificationController().MarkRead)
			notifications.POST("/mark-all-read", middleware.AuthMiddleware(), controllers.NewNotificationController().MarkAllRead)
		}

		// ====== 搜索路由 ======
		search := api.Group("/search")
		{
			search.GET("", controllers.NewSearchController().GlobalSearch)
			search.GET("/users", controllers.NewSearchController().SearchUsers)
			search.GET("/books", controllers.NewSearchController().SearchBooks)
			search.GET("/hot", controllers.NewSearchController().GetHotSearchKeywords)
			search.GET("/suggestions", controllers.NewSearchController().GetSuggestions)
			// 仅限管理员或开发测试使用
			search.POST("/sync", middleware.AuthMiddleware(), controllers.NewSearchController().SyncToElasticsearch)
		}

		// ====== 表情路由 ======
		emojis := api.Group("/emojis")
		{
			emojis.GET("", controllers.NewEmojiController().GetEmojis)
			emojis.GET("/categories", controllers.NewEmojiController().GetEmojiCategories)
			emojis.GET("/category", controllers.NewEmojiController().GetEmojisByCategory)
		}

		// 评价卖家
		api.POST("/evaluate", middleware.AuthMiddleware(), controllers.NewUserController().EvaluateUser)

		// 举报相关
		reports := api.Group("/reports")
		{
			reports.POST("", middleware.AuthMiddleware(), controllers.NewReportController().CreateReport)
		}

		// 对于前端自动发现后端地址或其他运行时配置
		api.GET("/config", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"apiBase": os.Getenv("API_BASE"),
			})
		})
	}

	// 管理员路由组（需验证角色为 admin）
	admin := r.Group("/api/admin", middleware.AuthMiddleware(), middleware.AdminMiddleware())
	{
		ac := controllers.NewAdminController()

		// Dashboard Stats
		admin.GET("/stats", ac.GetDashboardStats)

		// User Management
		admin.GET("/users", ac.GetUsers)
		admin.PUT("/users/:id/status", ac.UpdateUserStatus)
		admin.POST("/users/:id/role", controllers.NewReportController().AdminSetUserRole)

		// Book Management
		admin.GET("/books", ac.GetBooks)
		admin.PUT("/books/:id/status", ac.UpdateBookStatus)
		admin.DELETE("/books/:id", ac.DeleteBook)

		// Transaction Management
		admin.GET("/transactions", ac.GetTransactions)

		// Report Management
		admin.GET("/reports", controllers.NewReportController().ListReports)
		admin.POST("/reports/:id/resolve", controllers.NewReportController().ResolveReport)
	}

	// ====== WebSocket路由 ======
	r.GET("/ws", websocket.HandleConnection)
	r.GET("/ws/chat", websocket.HandleConnection)

	// ====== Prometheus Metrics ======
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// ====== 系统监控 ======
	// 仅限管理员访问（建议添加AdminMiddleware）
	monitor := r.Group("/api/monitor", middleware.AuthMiddleware())
	{
		monitor.GET("/stats", controllers.NewMonitorController().GetSystemStats)
	}
}
