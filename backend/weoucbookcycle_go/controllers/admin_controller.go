package controllers

import (
	"strconv"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"
	"weoucbookcycle_go/services"
	"weoucbookcycle_go/utils"

	"github.com/gin-gonic/gin"
)

type AdminController struct {
	monitorService *services.MonitorService
}

func NewAdminController() *AdminController {
	return &AdminController{
		monitorService: services.NewMonitorService(),
	}
}

// GetDashboardStats 获取管理后台首页统计
func (ac *AdminController) GetDashboardStats(c *gin.Context) {
	// 系统基础监控
	stats := ac.monitorService.GetSystemStats()

	// 业务统计
	var userCount int64
	config.DB.Model(&models.User{}).Count(&userCount)

	var bookCount int64
	config.DB.Model(&models.Book{}).Count(&bookCount)

	var transactionCount int64
	config.DB.Model(&models.Transaction{}).Count(&transactionCount)

	var reportCount int64
	config.DB.Model(&models.Report{}).Where("status = ?", "pending").Count(&reportCount)

	utils.Success(c, gin.H{
		"system":          stats,
		"users":           userCount,
		"books":           bookCount,
		"transactions":    transactionCount,
		"pending_reports": reportCount,
	})
}

// GetUsers 获取用户列表
func (ac *AdminController) GetUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	keyword := c.Query("keyword")
	role := c.Query("role")
	status := c.Query("status")

	offset := (page - 1) * limit

	query := config.DB.Model(&models.User{})

	if keyword != "" {
		query = query.Where("username LIKE ? OR email LIKE ? OR phone LIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}
	if role != "" {
		query = query.Where("role = ?", role)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var users []models.User
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&users).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to get users")
		return
	}

	utils.Success(c, gin.H{
		"users": users,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// UpdateUserStatus 更新用户状态（禁用/启用）
func (ac *AdminController) UpdateUserStatus(c *gin.Context) {
	id := c.Param("id")
	var body struct {
		Status int `json:"status"` // 1=正常, 0=禁用
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	if err := config.DB.Model(&models.User{}).Where("id = ?", id).Update("status", body.Status).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to update user status")
		return
	}

	utils.SuccessWithMessage(c, "User status updated", nil)
}

// GetBooks 获取书籍列表
func (ac *AdminController) GetBooks(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	keyword := c.Query("keyword")
	status := c.Query("status")

	offset := (page - 1) * limit

	query := config.DB.Model(&models.Book{}).Preload("Seller")

	if keyword != "" {
		query = query.Where("title LIKE ? OR author LIKE ? OR isbn LIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var books []models.Book
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&books).Error; err != nil {
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

// UpdateBookStatus 更新书籍状态（下架等）
func (ac *AdminController) UpdateBookStatus(c *gin.Context) {
	id := c.Param("id")
	var body struct {
		Status int `json:"status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	if err := config.DB.Model(&models.Book{}).Where("id = ?", id).Update("status", body.Status).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to update book status")
		return
	}

	utils.SuccessWithMessage(c, "Book status updated", nil)
}

// DeleteBook 删除书籍（物理删除或软删除）
func (ac *AdminController) DeleteBook(c *gin.Context) {
	id := c.Param("id")
	if err := config.DB.Delete(&models.Book{}, "id = ?", id).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to delete book")
		return
	}
	utils.SuccessWithMessage(c, "Book deleted", nil)
}

// GetTransactions 获取交易列表
func (ac *AdminController) GetTransactions(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	status := c.Query("status")

	offset := (page - 1) * limit

	query := config.DB.Model(&models.Transaction{}).Preload("Buyer").Preload("Seller").Preload("Listing").Preload("Listing.Book")

	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var transactions []models.Transaction
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&transactions).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to get transactions")
		return
	}

	utils.Success(c, gin.H{
		"transactions": transactions,
		"total":        total,
		"page":         page,
		"limit":        limit,
	})
}
