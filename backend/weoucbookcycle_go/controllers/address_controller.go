package controllers

import (
	"fmt"
	"net/http"
	"strconv"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"
	"weoucbookcycle_go/utils"

	"github.com/gin-gonic/gin"
)

// AddressController 地址控制器
type AddressController struct {
}

// NewAddressController 创建地址控制器实例
func NewAddressController() *AddressController {
	return &AddressController{}
}

// SearchAddressRequest 搜索地址请求
type SearchAddressRequest struct {
	Province string `json:"province"`
	City     string `json:"city"`
	Keyword  string `json:"keyword"`
	Page     int    `json:"page" default:"1"`
	Limit    int    `json:"limit" default:"20"`
}

// CreateAddressRequest 创建地址请求（管理员专用）
type CreateAddressRequest struct {
	Province string `json:"province" binding:"required"`
	City     string `json:"city" binding:"required"`
	District string `json:"district"`
	Address  string `json:"address"`
}

// CreateUserAddressRequest 用户创建地址请求（可选省市）
type CreateUserAddressRequest struct {
	Province string `json:"province" binding:"omitempty"`
	City     string `json:"city" binding:"omitempty"`
	District string `json:"district" binding:"omitempty"`
	Address  string `json:"address" binding:"required"`
}

// GetAddresses 获取地址列表
// @Summary 获取官方地址列表
// @Description 获取官方维护的地址列表，支持搜索和分页
// @Tags addresses
// @Accept json
// @Produce json
// @Param province query string false "省份"
// @Param city query string false "城市"
// @Param keyword query string false "关键词搜索"
// @Param page query int false "页码" default(1)
// @Param limit query int false "每页数量" default(20)
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/addresses [get]
func (ac *AddressController) GetAddresses(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit
	province := c.Query("province")
	city := c.Query("city")
	keyword := c.Query("keyword")

	query := config.DB.Model(&models.Address{}).Where("official = ? AND is_active = ?", true, true)

	if province != "" {
		query = query.Where("province LIKE ?", "%"+province+"%")
	}
	if city != "" {
		query = query.Where("city LIKE ?", "%"+city+"%")
	}
	if keyword != "" {
		// 支持在省/市/区/详细地址中关键字搜索，便于用户只输入部分关键词即可匹配
		likePattern := "%" + keyword + "%"
		query = query.Where("province LIKE ? OR city LIKE ? OR district LIKE ? OR address LIKE ?", likePattern, likePattern, likePattern, likePattern)
	}

	var total int64
	query.Count(&total)

	var addresses []models.Address
	if err := query.Order("province, city").Limit(limit).Offset(offset).Find(&addresses).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to get addresses")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"addresses": addresses,
		"total":     total,
		"page":      page,
		"limit":     limit,
	})
}

// CreateAddress 创建官方地址（管理员专用）
// @Summary 创建官方地址
// @Description 管理员创建官方地址
// @Tags addresses
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body CreateAddressRequest true "地址信息"
// @Success 201 {object} models.Address
// @Router /api/v1/addresses [post]
func (ac *AddressController) CreateAddress(c *gin.Context) {
	// 检查权限：只有管理员可以创建官方地址
	userID := c.GetString("user_id")
	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil || user.Role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can create official addresses"})
		return
	}

	var req CreateAddressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	address := models.Address{
		Province: req.Province,
		City:     req.City,
		District: req.District,
		Address:  req.Address,
		Official: true,
		IsActive: true,
	}

	if err := config.DB.Create(&address).Error; err != nil {
		// 打印并返回详细错误以便排查
		fmt.Printf("[CreateUserAddress] DB Error: %v\n", err)
		utils.Error(c, utils.CodeInternalServerError, "Failed to create address: "+err.Error())
		return
	}

	c.JSON(http.StatusCreated, address)
}

// DeleteAddress 删除地址（管理员专用）
// @Summary 删除地址
// @Description 管理员删除地址
// @Tags addresses
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path string true "地址ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/addresses/{id} [delete]
func (ac *AddressController) DeleteAddress(c *gin.Context) {
	// 检查权限
	userID := c.GetString("user_id")
	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil || user.Role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can delete addresses"})
		return
	}

	addressID := c.Param("id")
	if err := config.DB.Delete(&models.Address{}, "id = ?", addressID).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to delete address")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Address deleted successfully"})
}

// GetUserAddresses 获取用户自定义地址列表
// @Summary 获取用户自定义地址
// @Description 获取当前用户创建的自定义地址列表
// @Tags addresses
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {array} models.Address
// @Router /api/v1/addresses/user/custom [get]
func (ac *AddressController) GetUserAddresses(c *gin.Context) {
	userID := c.GetString("user_id")

	var addresses []models.Address
	if err := config.DB.Where("official = ? AND creator = ?", false, userID).Find(&addresses).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to get user addresses")
		return
	}

	c.JSON(http.StatusOK, gin.H{"addresses": addresses})
}

// CreateUserAddress 创建用户自定义地址
// @Summary 创建自定义地址
// @Description 用户创建自定义地址
// @Tags addresses
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body CreateAddressRequest true "地址信息"
// @Success 201 {object} models.Address
// @Router /api/v1/addresses/user/custom [post]
func (ac *AddressController) CreateUserAddress(c *gin.Context) {
	userID := c.GetString("user_id")

	var req CreateUserAddressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	address := models.Address{
		Province: req.Province,
		City:     req.City,
		District: req.District,
		Address:  req.Address,
		Official: false,
		Creator:  userID,
		IsActive: true,
	}

	if err := config.DB.Create(&address).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to create address")
		return
	}

	c.JSON(http.StatusCreated, address)
}

// DeleteUserAddress 删除用户自定义地址
// @Summary 删除用户自定义地址
// @Description 用户删除自己创建的地址
// @Tags addresses
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path string true "地址ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/addresses/user/custom/{id} [delete]
func (ac *AddressController) DeleteUserAddress(c *gin.Context) {
	userID := c.GetString("user_id")
	addressID := c.Param("id")

	// 检查地址是否属于当前用户
	var address models.Address
	if err := config.DB.First(&address, "id = ?", addressID).Error; err != nil {
		utils.Error(c, utils.CodeNotFound, "Address not found")
		return
	}

	if address.Creator != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only delete your own addresses"})
		return
	}

	if err := config.DB.Delete(&address).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to delete address")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Address deleted successfully"})
}
