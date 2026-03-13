package controllers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"sync"
	"time"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"
	"weoucbookcycle_go/services"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// SearchController 搜索控制器
type SearchController struct {
	redisClient   *redis.Client
	searchService *services.SearchService
}

// NewSearchController 创建搜索控制器实例
func NewSearchController() *SearchController {
	return &SearchController{
		redisClient:   config.GetRedisClient(),
		searchService: services.NewSearchService(),
	}
}

// SearchResult 搜索结果结构
type SearchResult struct {
	Books    []models.Book    `json:"books,omitempty"`
	Users    []models.User    `json:"users,omitempty"`
	Listings []models.Listing `json:"listings,omitempty"`
	Total    int              `json:"total"`
	Query    string           `json:"query"`
}

// GlobalSearch 全局搜索
// @Summary 全局搜索
// @Description 跨多个模块进行搜索 (使用Elasticsearch)
// @Tags search
// @Accept json
// @Produce json
// @Param q query string true "搜索关键词"
// @Param page query int false "页码" default(1)
// @Param limit query int false "每页数量" default(20)
// @Param category query string false "分类筛选"
// @Param min_price query number false "最低价格"
// @Param max_price query number false "最高价格"
// @Success 200 {object} SearchResult
// @Router /api/v1/search [get]
func (sc *SearchController) GlobalSearch(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query is required"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	from := (page - 1) * limit

	// 获取筛选条件
	category := c.Query("category")
	minPrice := c.Query("min_price")
	maxPrice := c.Query("max_price")

	// 尝试使用Elasticsearch搜索
	if config.GetElasticClient() != nil {
		var wg sync.WaitGroup
		var mu sync.Mutex
		result := SearchResult{
			Query: query,
		}

		// 并发搜索 Books
		wg.Add(1)
		go func() {
			defer wg.Done()

			// 构建书籍过滤条件
			filters := make(map[string]interface{})
			if category != "" {
				filters["category"] = category
			}
			if minPrice != "" {
				filters["min_price"] = minPrice
			}
			if maxPrice != "" {
				filters["max_price"] = maxPrice
			}

			res, err := sc.searchService.Search(services.IndexBooks, query, from, limit, filters)
			if err == nil {
				if hits, ok := res["hits"].(map[string]interface{}); ok {
					if hitList, ok := hits["hits"].([]interface{}); ok {
						var books []models.Book
						for _, hit := range hitList {
							if h, ok := hit.(map[string]interface{}); ok {
								if source, ok := h["_source"].(map[string]interface{}); ok {
									// 简单的映射，实际可能需要更复杂的转换
									jsonBody, _ := json.Marshal(source)
									var book models.Book
									json.Unmarshal(jsonBody, &book)
									books = append(books, book)
								}
							}
						}
						mu.Lock()
						result.Books = books
						result.Total += len(books)
						mu.Unlock()
					}
				}
			}
		}()

		// 并发搜索 Users
		wg.Add(1)
		go func() {
			defer wg.Done()
			// 用户搜索暂不支持额外的过滤条件
			res, err := sc.searchService.Search(services.IndexUsers, query, from, limit, nil)
			if err == nil {
				if hits, ok := res["hits"].(map[string]interface{}); ok {
					if hitList, ok := hits["hits"].([]interface{}); ok {
						var users []models.User
						for _, hit := range hitList {
							if h, ok := hit.(map[string]interface{}); ok {
								if source, ok := h["_source"].(map[string]interface{}); ok {
									jsonBody, _ := json.Marshal(source)
									var user models.User
									json.Unmarshal(jsonBody, &user)
									users = append(users, user)
								}
							}
						}
						mu.Lock()
						result.Users = users
						result.Total += len(users)
						mu.Unlock()
					}
				}
			}
		}()

		// 并发搜索 Listings
		wg.Add(1)
		go func() {
			defer wg.Done()

			// 构建发布过滤条件
			filters := make(map[string]interface{})
			if minPrice != "" {
				filters["min_price"] = minPrice
			}
			if maxPrice != "" {
				filters["max_price"] = maxPrice
			}

			res, err := sc.searchService.Search(services.IndexListings, query, from, limit, filters)
			if err == nil {
				if hits, ok := res["hits"].(map[string]interface{}); ok {
					if hitList, ok := hits["hits"].([]interface{}); ok {
						var listings []models.Listing
						for _, hit := range hitList {
							if h, ok := hit.(map[string]interface{}); ok {
								if source, ok := h["_source"].(map[string]interface{}); ok {
									jsonBody, _ := json.Marshal(source)
									var listing models.Listing
									json.Unmarshal(jsonBody, &listing)
									listings = append(listings, listing)
								}
							}
						}
						mu.Lock()
						result.Listings = listings
						result.Total += len(listings)
						mu.Unlock()
					}
				}
			}
		}()

		wg.Wait()
		c.JSON(http.StatusOK, result)
		return
	}

	// 降级到数据库搜索 (保留原有逻辑)
	sc.fallbackGlobalSearch(c, query, limit)
}

// fallbackGlobalSearch 数据库搜索降级方案
func (sc *SearchController) fallbackGlobalSearch(c *gin.Context, query string, limit int) {
	// ... (原有的数据库搜索逻辑)
	// 这里为了简化，我先不复制所有原有逻辑，实际应该保留作为 fallback
	// 简单返回空或错误提示，或者复制原有代码

	// 使用goroutine并发搜索多个数据源
	var wg sync.WaitGroup
	var mu sync.Mutex

	result := SearchResult{
		Query: query,
	}

	// 并发搜索书籍
	wg.Add(1)
	go func() {
		defer wg.Done()
		searchPattern := "%" + query + "%"
		var books []models.Book
		qb := config.DB.Where("status = ?", 1).
			Where("title LIKE ? OR author LIKE ? OR description LIKE ?", searchPattern, searchPattern, searchPattern)

		// 排除被当前用户拉黑的发布者
		userID := c.GetString("user_id")
		if userID != "" {
			sub := config.DB.Table("blocks").Select("blocked_id").Where("blocker_id = ?", userID)
			qb = qb.Not("seller_id IN (?)", sub)
		}

		qb.Limit(limit).Find(&books)
		mu.Lock()
		result.Books = books
		result.Total += len(books)
		mu.Unlock()
	}()

	// 并发搜索用户
	wg.Add(1)
	go func() {
		defer wg.Done()
		searchPattern := "%" + query + "%"
		var users []models.User
		config.DB.Where("username LIKE ? OR email LIKE ? OR bio LIKE ?", searchPattern, searchPattern, searchPattern).
			Limit(limit).Find(&users)
		mu.Lock()
		result.Users = users
		result.Total += len(users)
		mu.Unlock()
	}()

	// 并发搜索 Listings
	wg.Add(1)
	go func() {
		defer wg.Done()
		searchPattern := "%" + query + "%"
		var listings []models.Listing
		config.DB.Preload("Book").Where("status = ?", "available").
			Joins("JOIN books ON listings.book_id = books.id").
			Where("books.title LIKE ? OR books.author LIKE ? OR listings.note LIKE ?", searchPattern, searchPattern, searchPattern).
			Limit(limit).Find(&listings)
		mu.Lock()
		result.Listings = listings
		result.Total += len(listings)
		mu.Unlock()
	}()

	wg.Wait()
	c.JSON(http.StatusOK, result)
}

// SyncToElasticsearch 同步数据到Elasticsearch
// @Summary 同步数据
// @Description 将数据库数据同步到Elasticsearch
// @Tags search
// @Accept json
// @Produce json
// @Success 200 {object} map[string]string
// @Router /api/v1/search/sync [post]
func (sc *SearchController) SyncToElasticsearch(c *gin.Context) {
	// 仅允许管理员调用 (这里简单判断，实际应有权限控制)
	// if !isAdmin(c) { ... }

	go func() {
		// 1. 确保索引存在
		sc.searchService.EnsureIndices()

		// 2. 同步书籍
		var books []models.Book
		config.DB.Find(&books)
		for _, book := range books {
			sc.searchService.IndexBook(&book)
		}

		// 3. 同步用户
		var users []models.User
		config.DB.Find(&users)
		for _, user := range users {
			sc.searchService.IndexUser(&user)
		}

		// 4. 同步Listings
		var listings []models.Listing
		config.DB.Preload("Book").Find(&listings)
		for _, listing := range listings {
			sc.searchService.IndexListing(&listing)
		}
	}()

	c.JSON(http.StatusOK, gin.H{"message": "Sync started in background"})
}

// SearchUsers 搜索用户 (保持原样或更新)
func (sc *SearchController) SearchUsers(c *gin.Context) {
	// ... (可以保持原样，或者也切换到 ES)
	// 为保持兼容性，这里暂时只提供 GlobalSearch 的 ES 实现
	// 原有逻辑:
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query is required"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	searchPattern := "%" + query + "%"
	var users []models.User
	var total int64

	config.DB.Model(&models.User{}).Where("username LIKE ? OR email LIKE ? OR bio LIKE ?", searchPattern, searchPattern, searchPattern).Count(&total)
	config.DB.Where("username LIKE ? OR email LIKE ? OR bio LIKE ?", searchPattern, searchPattern, searchPattern).Limit(limit).Offset(offset).Find(&users)

	c.JSON(http.StatusOK, gin.H{
		"users": users,
		"total": total,
		"page":  page,
		"limit": limit,
		"query": query,
	})
}

// SearchBooks 搜索书籍
func (sc *SearchController) SearchBooks(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query is required"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit
	category := c.Query("category")

	searchPattern := "%" + query + "%"
	var books []models.Book
	var total int64

	baseQuery := config.DB.Model(&models.Book{}).Where("status = ?", 1).
		Where("title LIKE ? OR author LIKE ? OR description LIKE ? OR category LIKE ?", searchPattern, searchPattern, searchPattern, searchPattern)

	// 排除被当前用户拉黑的发布者
	userID := c.GetString("user_id")
	if userID != "" {
		sub := config.DB.Table("blocks").Select("blocked_id").Where("blocker_id = ?", userID)
		baseQuery = baseQuery.Not("seller_id IN (?)", sub)
	}

	if category != "" {
		baseQuery = baseQuery.Where("category = ?", category)
	}

	baseQuery.Count(&total)

	config.DB.Where("status = ?", 1).
		Where("title LIKE ? OR author LIKE ? OR description LIKE ? OR category LIKE ?", searchPattern, searchPattern, searchPattern, searchPattern).
		Preload("Seller").Limit(limit).Offset(offset).Find(&books)

	c.JSON(http.StatusOK, gin.H{
		"books": books,
		"total": total,
		"page":  page,
		"limit": limit,
		"query": query,
	})
}

// GetHotSearchKeywords 获取热门搜索词
func (sc *SearchController) GetHotSearchKeywords(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	keywords, err := sc.redisClient.ZRevRange(ctx, "search:hot", 0, int64(limit-1)).Result()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get hot search keywords"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"keywords": keywords})
}

// GetSuggestions 获取搜索建议
func (sc *SearchController) GetSuggestions(c *gin.Context) {
	query := c.Query("q")
	if query == "" || len(query) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query must be at least 2 characters"})
		return
	}

	// 优先使用Elasticsearch建议
	if config.GetElasticClient() != nil {
		// 从书籍索引获取建议
		suggestions, err := sc.searchService.Suggest(services.IndexBooks, query, 10)
		if err == nil && len(suggestions) > 0 {
			c.JSON(http.StatusOK, gin.H{"suggestions": suggestions})
			return
		}
	}

	// 降级：检查缓存或数据库
	cacheKey := "search:suggestions:" + query
	cached, err := sc.redisClient.Get(ctx, cacheKey).Result()
	if err == nil {
		var suggestions []string
		if json.Unmarshal([]byte(cached), &suggestions) == nil {
			c.JSON(http.StatusOK, gin.H{"suggestions": suggestions})
			return
		}
	}

	searchPattern := query + "%"
	var suggestions []string
	config.DB.Model(&models.Book{}).Where("title LIKE ? AND status = ?", searchPattern, 1).Limit(5).Pluck("title", &suggestions)

	// 缓存结果
	go func() {
		data, _ := json.Marshal(suggestions)
		sc.redisClient.Set(ctx, cacheKey, data, time.Minute*30)
	}()

	c.JSON(http.StatusOK, gin.H{"suggestions": suggestions})
}
