package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"
	"weoucbookcycle_go/services"
	"weoucbookcycle_go/utils"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// BookController 书籍控制器
type BookController struct {
	redisClient *redis.Client
	// 统计更新队列
	statsQueue chan BookStatUpdate
	workerWg   sync.WaitGroup
}

// BookStatUpdate 书籍统计更新任务
type BookStatUpdate struct {
	BookID string
	Type   string // "view", "like"
}

// NewBookController 创建书籍控制器实例
func NewBookController() *BookController {
	bc := &BookController{
		redisClient: config.GetRedisClient(),
		statsQueue:  make(chan BookStatUpdate, 1000), // 缓冲队列
	}

	// 启动统计worker池（使用goroutine）
	bc.startStatsWorkers()

	return bc
}

// initRedis 已废弃，使用 config.GetRedisClient()
// func initRedis() *redis.Client { ... }

// startStatsWorkers 启动统计更新worker池
// 使用goroutine和channel实现异步统计更新
func (bc *BookController) startStatsWorkers() {
	workerCount := 5 // 启动5个worker

	for i := 0; i < workerCount; i++ {
		bc.workerWg.Add(1)
		go bc.statsWorker(i)
	}
}

// statsWorker 统计更新worker
// 每个worker从channel中获取任务并处理
func (bc *BookController) statsWorker(workerID int) {
	defer bc.workerWg.Done()

	for stat := range bc.statsQueue {
		if err := bc.updateBookStats(stat); err != nil {
			// 可以添加错误日志
		}
	}
}

// updateBookStats 更新书籍统计信息
func (bc *BookController) updateBookStats(stat BookStatUpdate) error {
	switch stat.Type {
	case "view":
		// 原子操作增加浏览次数
		config.DB.Exec("UPDATE books SET view_count = view_count + 1 WHERE id = ?", stat.BookID)

		// 同时更新Redis中的浏览统计（用于排行榜）
		// 使用 ZIncrBy 保证原子性，即使失败也不会导致数据不一致（最多丢失一次计数）
		if err := bc.redisClient.ZIncrBy(ctx, "rank:book:views", 1, stat.BookID).Err(); err != nil {
			// 记录日志，但不中断流程
			fmt.Printf("Failed to update redis view count: %v\n", err)
		}

	case "like":
		config.DB.Exec("UPDATE books SET like_count = like_count + 1 WHERE id = ?", stat.BookID)
		if err := bc.redisClient.ZIncrBy(ctx, "rank:book:likes", 1, stat.BookID).Err(); err != nil {
			fmt.Printf("Failed to update redis like count: %v\n", err)
		}
	}

	return nil
}

// CreateBookRequest 创建书籍请求结构
type CreateBookRequest struct {
	Title       string   `json:"title" binding:"required,max=200"`
	Author      string   `json:"author" binding:"required,max=100"`
	ISBN        string   `json:"isbn" binding:"omitempty"`
	Category    string   `json:"category" binding:"required"`
	Price       float64  `json:"price" binding:"required,gt=0"`
	Description string   `json:"description"`
	Images      []string `json:"images"`
	Condition   string   `json:"condition" binding:"required,oneof=全新 九成新 八成新 七成新 其他"`
	AddressID   string   `json:"address_id" binding:"omitempty"` // 新增地址ID字段
}

// UpdateBookRequest 更新书籍请求结构
type UpdateBookRequest struct {
	Title       string   `json:"title" binding:"omitempty,max=200"`
	Author      string   `json:"author" binding:"omitempty,max=100"`
	Category    string   `json:"category" binding:"omitempty"`
	Price       float64  `json:"price" binding:"omitempty,gt=0"`
	Description string   `json:"description"`
	Images      []string `json:"images"`
	Condition   string   `json:"condition" binding:"omitempty,oneof=全新 九成新 八成新 七成新 其他"`
	Status      int      `json:"status" binding:"omitempty,oneof=0 1 2"`
	AddressID   string   `json:"address_id" binding:"omitempty"` // 新增地址ID字段
}

// GetBooks 获取书籍列表
// @Summary 获取书籍列表
// @Description 分页获取书籍列表，支持筛选和排序
// @Tags books
// @Accept json
// @Produce json
// @Param page query int false "页码" default(1)
// @Param limit query int false "每页数量" default(20)
// @Param category query string false "书籍分类"
// @Param author query string false "作者"
// @Param sort query string false "排序方式" default(created_at)
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/books [get]
func (bc *BookController) GetBooks(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit
	category := c.Query("category")
	author := c.Query("author")
	sortParam := c.DefaultQuery("sort", "newest")

	// 构建查询
	query := config.DB.Model(&models.Book{})

	// 如果有 status 参数，则按参数查询，否则默认查询 status=1 (在售)
	// 但如果调用方没有传 status，我们默认只查在售的，除非是特定接口
	// 为了兼容，我们检查是否有 user_id 参数，如果是查自己的书，可能需要查所有状态？
	// 这里的 GetBooks 是公共接口，通常只返回在售的。
	// 用户想要看自己的书，应该调用 GetMyBooks 或在 GetBooks 增加参数

	// 根据需求：发布者不会在自己账号中的市场中看到自己发布的书
	// 获取当前登录用户ID (如果已登录)
	currentUserID := c.GetString("user_id")
	if currentUserID != "" {
		query = query.Where("seller_id != ?", currentUserID)
		// 排除被当前用户拉黑的发布者
		sub := config.DB.Table("blocks").Select("blocked_id").Where("blocker_id = ?", currentUserID)
		query = query.Not("seller_id IN (?)", sub)
	}

	query = query.Where("status = ?", 1)

	if category != "" && category != "All" {
		query = query.Where("category = ?", category)
	}
	if author != "" {
		query = query.Where("author LIKE ?", "%"+author+"%")
	}

	// 排序映射
	orderClause := "created_at DESC"
	switch sortParam {
	case "newest":
		orderClause = "created_at DESC"
	case "price_asc":
		orderClause = "price ASC"
	case "price_desc":
		orderClause = "price DESC"
	case "created_at": // 兼容默认值
		orderClause = "created_at DESC"
	}

	// 获取总数
	var total int64
	query.Count(&total)

	// 获取数据
	var books []models.Book
	if err := query.
		Preload("Seller").
		Order(orderClause).
		Limit(limit).
		Offset(offset).
		Find(&books).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to get books")
		return
	}

	utils.Success(c, gin.H{
		"books": books,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetBook 获取书籍详情
// @Summary 获取书籍详情
// @Description 根据书籍ID获取详细信息
// @Tags books
// @Accept json
// @Produce json
// @Param id path string true "书籍ID"
// @Success 200 {object} models.Book
// @Router /api/v1/books/{id} [get]
func (bc *BookController) GetBook(c *gin.Context) {
	bookID := c.Param("id")

	// 先尝试从Redis缓存获取
	cacheKey := "book:" + bookID
	cached, err := bc.redisClient.Get(ctx, cacheKey).Result()
	if err == nil {
		var book models.Book
		if json.Unmarshal([]byte(cached), &book) == nil {
			// 异步更新浏览统计（不阻塞响应）
			currentUserID := c.GetString("user_id")
			if book.SellerID != currentUserID {
				bc.statsQueue <- BookStatUpdate{BookID: bookID, Type: "view"}
			}

			// 统计收藏数与当前用户是否已收藏
			var favCount int64
			config.DB.Model(&models.Wishlist{}).Where("book_id = ?", bookID).Count(&favCount)

			isWishlisted := false
			if currentUserID != "" {
				var cnt int64
				config.DB.Model(&models.Wishlist{}).Where("user_id = ? AND book_id = ?", currentUserID, bookID).Count(&cnt)
				if cnt > 0 {
					isWishlisted = true
				}
			}

			utils.Success(c, gin.H{
				"book":           book,
				"favorite_count": favCount,
				"is_wishlisted":  isWishlisted,
				"like_count":     book.LikeCount,
			})
			return
		}
	}

	// 缓存未命中，从数据库查询
	var book models.Book
	if err := config.DB.Preload("Seller").Preload("Address").First(&book, "id = ?", bookID).Error; err != nil {
		utils.Error(c, utils.CodeNotFound, "Book not found")
		return
	}

	// 异步更新浏览统计（每次打开详情页都算一次浏览）
	bc.statsQueue <- BookStatUpdate{BookID: bookID, Type: "view"}

	// 本地数据也加一，避免前端从刚缓存的对象中看不到增长
	book.ViewCount++

	// 统计收藏数与当前用户是否已收藏
	var favCount int64
	config.DB.Model(&models.Wishlist{}).Where("book_id = ?", bookID).Count(&favCount)

	currentUserID := c.GetString("user_id")
	isWishlisted := false
	if currentUserID != "" {
		var cnt int64
		config.DB.Model(&models.Wishlist{}).Where("user_id = ? AND book_id = ?", currentUserID, bookID).Count(&cnt)
		if cnt > 0 {
			isWishlisted = true
		}
	}

	// 异步缓存到Redis（使用goroutine）
	go func() {
		data, _ := json.Marshal(book)
		bc.redisClient.Set(ctx, cacheKey, data, time.Minute*10)
	}()

	utils.Success(c, gin.H{
		"book":           book,
		"favorite_count": favCount,
		"is_wishlisted":  isWishlisted,
		"like_count":     book.LikeCount,
	})
}

// CreateBook 创建书籍
// @Summary 创建书籍
// @Description 创建新的书籍信息
// @Tags books
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body CreateBookRequest true "书籍信息"
// @Success 201 {object} models.Book
// @Router /api/v1/books [post]
func (bc *BookController) CreateBook(c *gin.Context) {
	userID := c.GetString("user_id")

	// 打印调试信息
	fmt.Printf("[CreateBook] UserID: %s\n", userID)

	// 如果未登录或中间件未设置 user_id，返回未授权错误，避免造成 DB 插入时的 NOT NULL 失败
	if userID == "" {
		utils.Error(c, utils.CodeUnauthorized, "未登录或身份验证已过期")
		return
	}

	var req CreateBookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	// 转换图片数组为JSON字符串
	imagesJSON, _ := json.Marshal(req.Images)

	// Ensure images is a valid JSON array string
	imagesStr := string(imagesJSON)
	if imagesStr == "null" {
		imagesStr = "[]"
	}

	var isbn *string
	if req.ISBN != "" {
		isbn = &req.ISBN
	}

	book := models.Book{
		Title:       req.Title,
		Author:      req.Author,
		ISBN:        isbn,
		Category:    req.Category,
		Price:       req.Price,
		Description: req.Description,
		Images:      imagesStr,
		Condition:   req.Condition,
		SellerID:    userID,
		Status:      1,
		AddressID: func() *string {
			if req.AddressID != "" {
				return &req.AddressID
			}
			return nil
		}(), // 如果提供了地址ID则设置
	}

	if err := config.DB.Create(&book).Error; err != nil {
		// 打印详细错误
		fmt.Printf("[CreateBook] DB Error: %v\n", err)
		// 如果是缺失 address_id 列导致的错误，尝试自动添加列并重试一次
		errStr := err.Error()
		if strings.Contains(errStr, "Unknown column") || strings.Contains(errStr, "1054") {
			fmt.Println("Detected missing column, attempting to add books.address_id and retry")
			if migrErr := config.DB.Migrator().AddColumn(&models.Book{}, "AddressID"); migrErr != nil {
				fmt.Printf("Failed to add AddressID column: %v\n", migrErr)
				utils.Error(c, utils.CodeInternalServerError, "Failed to create book: database schema missing and automatic fix failed")
				return
			}
			// 重试创建
			if retryErr := config.DB.Create(&book).Error; retryErr != nil {
				fmt.Printf("[CreateBook] Retry DB Error: %v\n", retryErr)
				utils.Error(c, utils.CodeInternalServerError, "Failed to create book after attempting schema fix")
				return
			}
		} else {
			// 如果是重复 ISBN 错误，返回更友好的错误信息
			if strings.Contains(errStr, "Duplicate entry") && strings.Contains(errStr, "idx_books_isbn") {
				utils.Error(c, utils.CodeValidationError, "ISBN 已存在，请检查输入或留空")
				return
			}
			utils.Error(c, utils.CodeInternalServerError, "Failed to create book: "+err.Error())
			return
		}
	}

	// 清除热门书籍缓存
	go func() {
		bc.redisClient.Del(ctx, "hot:books")
	}()

	utils.Success(c, book)
}

// UpdateBook 更新书籍
// @Summary 更新书籍
// @Description 更新书籍信息
// @Tags books
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path string true "书籍ID"
// @Param request body UpdateBookRequest true "书籍信息"
// @Success 200 {object} models.Book
// @Router /api/v1/books/{id} [put]
func (bc *BookController) UpdateBook(c *gin.Context) {
	userID := c.GetString("user_id")
	bookID := c.Param("id")

	var book models.Book
	if err := config.DB.First(&book, "id = ?", bookID).Error; err != nil {
		utils.Error(c, utils.CodeNotFound, "Book not found")
		return
	}

	// 检查权限
	if book.SellerID != userID {
		utils.Error(c, utils.CodeForbidden, "You don't have permission to update this book")
		return
	}

	var req UpdateBookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	// 构建更新map
	updates := make(map[string]interface{})
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Author != "" {
		updates["author"] = req.Author
	}
	if req.Category != "" {
		updates["category"] = req.Category
	}
	if req.Price > 0 {
		updates["price"] = req.Price
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if len(req.Images) > 0 {
		imagesJSON, _ := json.Marshal(req.Images)
		updates["images"] = string(imagesJSON)
	}
	if req.Condition != "" {
		updates["condition"] = req.Condition
	}
	if req.AddressID != "" {
		updates["address_id"] = req.AddressID
	}
	if req.Status >= 0 {
		updates["status"] = req.Status
	}

	if err := config.DB.Model(&book).Updates(updates).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to update book")
		return
	}

	// 删除缓存
	go func() {
		bc.redisClient.Del(ctx, "book:"+bookID)
		bc.redisClient.Del(ctx, "hot:books")
	}()

	utils.Success(c, book)
}

// DeleteBook 删除书籍
// @Summary 删除书籍
// @Description 删除书籍（软删除）
// @Tags books
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path string true "书籍ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/books/{id} [delete]
func (bc *BookController) DeleteBook(c *gin.Context) {
	userID := c.GetString("user_id")
	bookID := c.Param("id")

	var book models.Book
	if err := config.DB.First(&book, "id = ?", bookID).Error; err != nil {
		utils.Error(c, utils.CodeNotFound, "Book not found")
		return
	}

	// 检查权限
	if book.SellerID != userID {
		utils.Error(c, utils.CodeForbidden, "You don't have permission to delete this book")
		return
	}

	if err := config.DB.Delete(&book).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to delete book")
		return
	}

	// 删除缓存
	go func() {
		bc.redisClient.Del(ctx, "book:"+bookID)
		bc.redisClient.Del(ctx, "hot:books")
	}()

	utils.SuccessWithMessage(c, "Book deleted successfully", nil)
}

// GetHotBooks 获取热门书籍
// @Summary 获取热门书籍
// @Description 获取热门/推荐书籍列表（从Redis缓存）
// @Tags books
// @Accept json
// @Produce json
// @Param limit query int false "数量" default(10)
// @Success 200 {array} models.Book
// @Router /api/v1/books/hot [get]
func (bc *BookController) GetHotBooks(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	// 先从Redis获取缓存
	cacheKey := "hot:books"
	cached, err := bc.redisClient.Get(ctx, cacheKey).Result()
	if err == nil {
		var books []models.Book
		if json.Unmarshal([]byte(cached), &books) == nil {
			c.JSON(http.StatusOK, gin.H{"books": books})
			return
		}
	}

	// 缓存未命中，从数据库获取热门书籍
	var books []models.Book

	query := config.DB.
		Preload("Seller"). // 预加载卖家信息，以便前端展示评分
		Where("status = ?", 1).
		Order("view_count DESC, like_count DESC, created_at DESC").
		Limit(limit)

	// 排除当前用户发布的书籍
	userID := c.GetString("user_id")
	if userID != "" {
		query = query.Where("seller_id != ?", userID)
	}

	if err := query.Find(&books).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to get hot books")
		return
	}

	// 异步缓存到Redis
	go func() {
		data, _ := json.Marshal(books)
		bc.redisClient.Set(ctx, cacheKey, data, time.Minute*10)
	}()

	utils.Success(c, gin.H{"books": books})
}

// GetLatestBooks 获取最新书籍
// @Summary 获取最新书籍
// @Description 获取最新发布的书籍列表
// @Tags books
// @Accept json
// @Produce json
// @Param limit query int false "数量" default(10)
// @Success 200 {array} models.Book
// @Router /api/v1/books/latest [get]
func (bc *BookController) GetLatestBooks(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	// 先从Redis获取缓存
	cacheKey := "latest:books"
	cached, err := bc.redisClient.Get(ctx, cacheKey).Result()
	if err == nil {
		var books []models.Book
		if json.Unmarshal([]byte(cached), &books) == nil {
			c.JSON(http.StatusOK, gin.H{"books": books})
			return
		}
	}

	// 缓存未命中，从数据库获取最新书籍
	var books []models.Book

	query := config.DB.
		Preload("Seller").
		Where("status = ?", 1).
		Order("created_at DESC").
		Limit(limit)

	// 排除当前用户发布的书籍
	userID := c.GetString("user_id")
	if userID != "" {
		query = query.Where("seller_id != ?", userID)
	}

	if err := query.Find(&books).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to get latest books")
		return
	}

	// 异步缓存到Redis
	go func() {
		data, _ := json.Marshal(books)
		bc.redisClient.Set(ctx, cacheKey, data, time.Minute*10)
	}()

	utils.Success(c, gin.H{"books": books})
}

// SearchBooks 搜索书籍
// @Summary 搜索书籍
// @Description 全文搜索书籍
// @Tags books
// @Accept json
// @Produce json
// @Param q query string true "搜索关键词"
// @Param page query int false "页码" default(1)
// @Param limit query int false "每页数量" default(20)
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/books/search [get]
func (bc *BookController) SearchBooks(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		utils.Error(c, utils.CodeValidationError, "Search query is required")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	// 先检查Redis缓存
	cacheKey := "search:" + query + ":" + strconv.Itoa(page)
	cached, err := bc.redisClient.Get(ctx, cacheKey).Result()
	if err == nil {
		var result map[string]interface{}
		if json.Unmarshal([]byte(cached), &result) == nil {
			utils.Success(c, result)
			return
		}
	}

	// 记录搜索关键词（用于热门搜索统计）
	go func() {
		bc.redisClient.ZIncrBy(ctx, "search:hot", 1, query)
		bc.redisClient.Expire(ctx, "search:hot", time.Hour*24)
	}()

	// 数据库搜索
	searchPattern := "%" + query + "%"
	var books []models.Book
	var total int64

	baseQuery := config.DB.Model(&models.Book{}).Where("status = ?", 1).
		Where("title LIKE ? OR author LIKE ? OR description LIKE ? OR category LIKE ?",
			searchPattern, searchPattern, searchPattern, searchPattern)

	// 如果已登录，排除被当前用户拉黑的发布者
	userID := c.GetString("user_id")
	if userID != "" {
		sub := config.DB.Table("blocks").Select("blocked_id").Where("blocker_id = ?", userID)
		baseQuery = baseQuery.Not("seller_id IN (?)", sub)
	}

	baseQuery.Count(&total)

	if err := baseQuery.
		Preload("Seller").
		Limit(limit).
		Offset(offset).
		Find(&books).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to search books")
		return
	}

	result := gin.H{
		"books": books,
		"total": total,
		"page":  page,
		"limit": limit,
		"query": query,
	}

	// 异步缓存搜索结果
	go func() {
		data, _ := json.Marshal(result)
		bc.redisClient.Set(ctx, cacheKey, data, time.Minute*5)
	}()

	utils.Success(c, result)
}

// LikeBookRequest 点赞请求结构
type LikeBookRequest struct {
	BookID string `json:"book_id" binding:"required"`
}

// LikeBook 点赞书籍
// @Summary 点赞书籍
// @Description 点赞或取消点赞书籍
// @Tags books
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path string true "书籍ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/books/:id/like [post]
func (bc *BookController) LikeBook(c *gin.Context) {
	userID := c.GetString("user_id")
	bookID := c.Param("id")

	bookService := services.NewBookService()

	liked, err := bookService.LikeBook(userID, bookID)
	if err != nil {
		utils.Error(c, utils.CodeInternalServerError, err.Error())
		return
	}

	message := "Liked successfully"
	if !liked {
		message = "Unliked successfully"
	}

	utils.SuccessWithMessage(c, message, gin.H{
		"book_id": bookID,
		"liked":   liked,
	})
}

// GetRecommendations 获取推荐书籍
// @Summary 获取推荐书籍
// @Description 基于用户历史获取推荐书籍
// @Tags books
// @Accept json
// @Produce json
// @Security Bearer
// @Param limit query int false "数量" default(10)
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/books/recommendations [get]
func (bc *BookController) GetRecommendations(c *gin.Context) {
	userID := c.GetString("user_id")
	limit := bc.parseIntQuery(c.DefaultQuery("limit", "10"))

	bookService := services.NewBookService()

	books, err := bookService.GetRecommendations(userID, limit)
	if err != nil {
		utils.Error(c, utils.CodeInternalServerError, err.Error())
		return
	}

	utils.SuccessWithMessage(c, "Success", gin.H{
		"books": books,
	})
}

// parseIntQuery 解析整型查询参数
func (bc *BookController) parseIntQuery(value string) int {
	var result int
	if _, err := fmt.Sscanf(value, "%d", &result); err != nil {
		result = 10
	}
	return result
}
