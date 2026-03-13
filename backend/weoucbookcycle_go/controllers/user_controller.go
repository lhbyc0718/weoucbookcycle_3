package controllers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"
	"weoucbookcycle_go/services"
	"weoucbookcycle_go/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// UserController 用户控制器
type UserController struct {
	searchService *services.SearchService
}

// NewUserController 创建用户控制器实例
func NewUserController() *UserController {
	return &UserController{
		searchService: services.NewSearchService(),
	}
}

// UpdateProfileRequest 更新用户资料请求结构
type UpdateProfileRequest struct {
	Username string `json:"username" binding:"omitempty,min=3,max=50"`
	Avatar   string `json:"avatar" binding:"omitempty"`
	Phone    string `json:"phone" binding:"omitempty"`
	Bio      string `json:"bio" binding:"omitempty,max=500"`
}

// GetUserProfile 获取用户资料
// @Summary 获取用户资料
// @Description 根据用户ID获取用户详细信息
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "用户ID"
// @Success 200 {object} models.User
// @Router /api/v1/users/{id} [get]
func (uc *UserController) GetUserProfile(c *gin.Context) {
	userID := c.Param("id")
	// 先尝试从Redis缓存获取
	cacheKey := "user:" + userID

	cachedData, err := config.RedisClient.Get(context.Background(), cacheKey).Result()
	if err == nil {
		var cachedResponse map[string]interface{}
		if err := json.Unmarshal([]byte(cachedData), &cachedResponse); err == nil {
			c.JSON(http.StatusOK, cachedResponse)
			return
		}
	}

	var user models.User
	if err := config.DB.Preload("Books").Preload("Books.Listings").Preload("Listings").First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// 如果当前请求者被该用户拉黑，则禁止查看（HTTP 403）
	viewerID := c.GetString("user_id")
	if viewerID != "" && viewerID != userID {
		var blk models.Block
		if err := config.DB.Where("blocker_id = ? AND blocked_id = ?", userID, viewerID).First(&blk).Error; err == nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "You are blocked by this user"})
			return
		}
	}

	// 计算统计数据
	stats := uc.getUserStats(userID)

	// trust score cap at 100
	trustScore := user.TrustScore
	if trustScore > 100 {
		trustScore = 100
	}

	// 构造完整响应
	userResponse := map[string]interface{}{
		"id":              user.ID,
		"username":        user.Username,
		"email":           user.Email,
		"avatar":          user.Avatar,
		"phone":           user.Phone,
		"bio":             user.Bio,
		"trustScore":      trustScore,
		"trust_score":     trustScore,
		"email_verified":  user.EmailVerified,
		"created_at":      user.CreatedAt,
		"updated_at":      user.UpdatedAt,
		"role":            user.Role,
		"Books":           user.Books,
		"Listings":        user.Listings,
		"published_count": len(user.Books),
		"total_likes":     stats.TotalLikes,
		"total_favorites": stats.TotalFavorites,
		"sold_count":      stats.SoldCount,
	}

	// 异步缓存用户信息到Redis（使用goroutine）
	go func() {
		cacheData, _ := json.Marshal(userResponse)
		config.RedisClient.Set(context.Background(), cacheKey, cacheData, time.Minute*30)
	}()

	c.JSON(http.StatusOK, userResponse)
}

// UpdateUserProfile 更新用户资料
// @Summary 更新用户资料
// @Description 更新当前登录用户的资料信息
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body UpdateProfileRequest true "用户资料"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/users/profile [put]
func (uc *UserController) UpdateUserProfile(c *gin.Context) {
	userID := c.GetString("user_id") // 从中间件获取

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 构建更新map
	updates := make(map[string]interface{})
	if req.Username != "" {
		updates["username"] = req.Username
	}
	if req.Avatar != "" {
		updates["avatar"] = req.Avatar
	}
	if req.Phone != "" {
		updates["phone"] = req.Phone
	}
	if req.Bio != "" {
		updates["bio"] = req.Bio
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	var user models.User
	if err := config.DB.Model(&user).Where("id = ?", userID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	// 删除Redis缓存
	// go func() {
	//     config.Redis.Del(context.Background(), "user:"+userID)
	// }()

	// 异步更新搜索索引
	go func() {
		// 需要重新查询完整信息
		var u models.User
		config.DB.First(&u, "id = ?", userID)
		uc.searchService.IndexUser(&u)
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Profile updated successfully",
		"user":    user,
	})
}

// GetActiveUsers 获取活跃用户列表
// @Summary 获取活跃用户列表
// @Description 获取最近的活跃用户，用于消息页面
// @Tags users
// @Accept json
// @Produce json
// @Param page query int false "页码" default(1)
// @Param limit query int false "每页数量" default(20)
// @Success 200 {array} models.User
// @Router /api/v1/users/active [get]
func (uc *UserController) GetActiveUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	var users []models.User
	if err := config.DB.
		Order("last_login DESC").
		Limit(limit).
		Offset(offset).
		Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"users": users,
		"page":  page,
		"limit": limit,
	})
}

// GetOnlineUsers 获取在线用户列表
// @Summary 获取在线用户列表
// @Description 获取当前在线的用户列表
// @Tags users
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/users/online [get]
func (uc *UserController) GetOnlineUsers(c *gin.Context) {
	chatService := services.NewChatService()

	onlineUsers, err := chatService.GetOnlineUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 50000, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    20000,
		"message": "Success",
		"data": gin.H{
			"online_users": onlineUsers,
			"count":        len(onlineUsers),
		},
	})
}

// BlockUser 拉黑指定用户（当前登录用户为拉黑者）
func (uc *UserController) BlockUser(c *gin.Context) {
	blockerID := c.GetString("user_id")
	if blockerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	targetID := c.Param("id")
	if targetID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "target id required"})
		return
	}

	// 幂等插入
	block := models.Block{ID: utils.GenerateUUID(), BlockerID: blockerID, BlockedID: targetID, CreatedAt: time.Now()}
	if err := config.DB.Where("blocker_id = ? AND blocked_id = ?", blockerID, targetID).First(&models.Block{}).Error; err == nil {
		c.JSON(http.StatusOK, gin.H{"message": "Already blocked"})
		return
	}

	if err := config.DB.Create(&block).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to block user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User blocked"})
}

// UnblockUser 解除拉黑
func (uc *UserController) UnblockUser(c *gin.Context) {
	blockerID := c.GetString("user_id")
	if blockerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	targetID := c.Param("id")
	if targetID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "target id required"})
		return
	}

	if err := config.DB.Where("blocker_id = ? AND blocked_id = ?", blockerID, targetID).Delete(&models.Block{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to unblock user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User unblocked"})
}

// GetMyProfile 获取当前登录用户资料
func (uc *UserController) GetMyProfile(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var user models.User
	if err := config.DB.Preload("Books").Preload("Books.Listings").Preload("Listings").Preload("WishlistItems").First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// 计算统计数据
	stats := uc.getUserStats(userID)

	// trust score cap at 100
	trustScore := user.TrustScore
	if trustScore > 100 {
		trustScore = 100
	}

	// 构造响应，兼容旧前端逻辑，将 WishlistItems 转换为 wishlist ID 列表
	userResponse := map[string]interface{}{
		"id":             user.ID,
		"username":       user.Username,
		"email":          user.Email,
		"avatar":         user.Avatar,
		"phone":          user.Phone,
		"bio":            user.Bio,
		"trustScore":     trustScore,
		"trust_score":    trustScore,
		"email_verified": user.EmailVerified,
		"created_at":     user.CreatedAt,
		"updated_at":     user.UpdatedAt,
		"role":           user.Role,
		"Books":          user.Books, // Changed from "books" to "Books" to match frontend interface
		"Listings":       user.Listings,
		// 统计数据
		"published_count": len(user.Books),
		"total_likes":     stats.TotalLikes,
		"total_favorites": stats.TotalFavorites,
		"sold_count":      stats.SoldCount,
	}

	var wishlistIDs []string
	// Use Preloaded WishlistItems
	for _, item := range user.WishlistItems {
		wishlistIDs = append(wishlistIDs, item.BookID)
	}
	userResponse["wishlist"] = wishlistIDs
	userResponse["wishlist_items"] = user.WishlistItems

	c.JSON(http.StatusOK, userResponse)
}

// ToggleWishlist 切换心愿单中的书籍
func (uc *UserController) ToggleWishlist(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// 检查请求体
	var body struct {
		BookID string `json:"bookId"` // 兼容前端可能传 bookId
	}

	// 如果直接绑定失败，尝试手动解析，因为前端可能传的是 url param id
	bookID := c.Param("id")
	if bookID == "" {
		// 尝试从 body 获取
		if err := c.ShouldBindJSON(&body); err == nil {
			bookID = body.BookID
		}
	}

	if bookID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Book ID is required"})
		return
	}

	// 检查书籍是否存在
	var book models.Book
	if err := config.DB.First(&book, "id = ?", bookID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Book not found"})
		return
	}

	// 原子地切换收藏：先查找，存在则删除；不存在则创建。
	var wishlistItem models.Wishlist
	res := config.DB.Where("user_id = ? AND book_id = ?", userID, bookID).First(&wishlistItem)

	isWishlisted := false
	if res.Error == nil {
		// 已存在，尝试删除；删除失败记录日志但返回成功（保持幂等）
		if delErr := config.DB.Delete(&wishlistItem).Error; delErr != nil {
			fmt.Printf("[ToggleWishlist] delete error: %v\n", delErr)
		}
		isWishlisted = false
	} else if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		// 不存在，创建；若并发导致唯一索引冲突，视为已收藏成功
		newWishlist := models.Wishlist{UserID: userID, BookID: bookID}
		if createErr := config.DB.Create(&newWishlist).Error; createErr != nil {
			// 并发或唯一索引冲突时再次确认是否已存在
			var check models.Wishlist
			if config.DB.Where("user_id = ? AND book_id = ?", userID, bookID).First(&check).Error == nil {
				isWishlisted = true
			} else {
				utils.Error(c, utils.CodeInternalServerError, "Failed to add to wishlist: "+createErr.Error())
				return
			}
		} else {
			isWishlisted = true
		}
	} else {
		// 其他数据库错误
		utils.Error(c, utils.CodeInternalServerError, "Database error: "+res.Error.Error())
		return
	}

	// 计算当前收藏数量并返回状态
	var favCount int64
	config.DB.Model(&models.Wishlist{}).Where("book_id = ?", bookID).Count(&favCount)

	utils.SuccessWithMessage(c, "Toggle wishlist success", gin.H{
		"book_id":        bookID,
		"favorite_count": favCount,
		"is_wishlisted":  isWishlisted,
	})
}

// EvaluateUser 评价卖家并调整信任分
func (uc *UserController) EvaluateUser(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var body struct {
		SellerID string `json:"seller_id" binding:"required"`
		IsGood   bool   `json:"is_good"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var seller models.User
	if err := config.DB.First(&seller, "id = ?", body.SellerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Seller not found"})
		return
	}

	// 简单规则：好评 +1，差评 -5，范围 0-100
	if body.IsGood {
		seller.TrustScore += 1
	} else {
		seller.TrustScore -= 5
	}
	if seller.TrustScore < 0 {
		seller.TrustScore = 0
	}
	if seller.TrustScore > 100 {
		seller.TrustScore = 100
	}

	if err := config.DB.Model(&seller).Update("trust_score", seller.TrustScore).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update trust score"})
		return
	}

	c.JSON(http.StatusOK, seller)
}

// UserStats 用户统计数据
type UserStats struct {
	TotalLikes     int64
	TotalFavorites int64
	SoldCount      int64
}

// getUserStats 获取用户的统计数据：总点赞数、总收藏数、已卖出数
func (uc *UserController) getUserStats(userID string) UserStats {
	var stats UserStats

	// 1. 计算总点赞数：用户发布的所有书籍的点赞数总和
	var totalLikes int64
	config.DB.Model(&models.Book{}).Where("seller_id = ?", userID).Select("COALESCE(SUM(likes), 0)").Row().Scan(&totalLikes)
	stats.TotalLikes = totalLikes

	// 2. 计算收藏数：统计用户发布的书籍在 wishlists 表中的被收藏次数
	var totalFavorites int64
	// 使用子查询或 Join 来统计该用户发布的书籍总共被收藏了多少次
	config.DB.Table("wishlists").
		Joins("JOIN books ON books.id = wishlists.book_id").
		Where("books.seller_id = ?", userID).
		Count(&totalFavorites)
	stats.TotalFavorites = totalFavorites

	// 3. 计算已卖出数：该用户作为卖家已完成的交易数
	var soldCount int64
	config.DB.Model(&models.Transaction{}).Where("seller_id = ? AND status = ?", userID, "completed").Count(&soldCount)
	stats.SoldCount = soldCount

	return stats
}
