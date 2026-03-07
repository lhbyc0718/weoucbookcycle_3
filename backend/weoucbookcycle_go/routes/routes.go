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
	api := r.Group("/api", middleware.RateLimitMiddleware())
	{
		// ====== 认证路由 (无需认证) ======
		auth := api.Group("/auth")
		{
			auth.POST("/register", controllers.NewAuthController().Register)
			auth.POST("/login", controllers.NewAuthController().Login)
			// 微信小程序登录，无需邮箱密码
			auth.POST("/wechat", controllers.NewAuthController().WeChatLogin)
			auth.POST("/refresh", controllers.NewAuthController().RefreshToken)
			auth.POST("/logout", controllers.NewAuthController().Logout)
			auth.POST("/verify-email", controllers.NewAuthController().VerifyEmail)
			auth.POST("/resend-verification", controllers.NewAuthController().ResendVerificationCode)
			auth.POST("/send-password-reset", controllers.NewAuthController().SendPasswordResetToken)
			auth.POST("/reset-password", controllers.NewAuthController().ResetPassword)
		}

		// ====== 用户路由 ======
		users := api.Group("/users")
		{
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
			books.GET("", controllers.NewBookController().GetBooks)
			books.GET("/hot", controllers.NewBookController().GetHotBooks)
			books.GET("/search", controllers.NewBookController().SearchBooks)
			books.GET("/recommendations", middleware.AuthMiddleware(), controllers.NewBookController().GetRecommendations)
			books.GET("/:id", controllers.NewBookController().GetBook)
			books.POST("", middleware.AuthMiddleware(), controllers.NewBookController().CreateBook)
			books.PUT("/:id", middleware.AuthMiddleware(), controllers.NewBookController().UpdateBook)
			books.DELETE("/:id", middleware.AuthMiddleware(), controllers.NewBookController().DeleteBook)
			books.POST("/:id/like", middleware.AuthMiddleware(), controllers.NewBookController().LikeBook)
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
		}

		// ====== 搜索路由 ======
		search := api.Group("/search")
		{
			search.GET("", controllers.NewSearchController().GlobalSearch)
			search.GET("/users", controllers.NewSearchController().SearchUsers)
			search.GET("/books", controllers.NewSearchController().SearchBooks)
			search.GET("/hot", controllers.NewSearchController().GetHotSearchKeywords)
			search.GET("/suggestions", controllers.NewSearchController().GetSuggestions)
		}

		// 评价卖家
		api.POST("/evaluate", middleware.AuthMiddleware(), controllers.NewUserController().EvaluateUser)

		// 对于前端自动发现后端地址或其他运行时配置
		api.GET("/config", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"apiBase": os.Getenv("API_BASE"),
			})
		})
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
