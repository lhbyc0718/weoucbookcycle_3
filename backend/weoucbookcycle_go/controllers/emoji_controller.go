package controllers

import (
	"net/http"
	"weoucbookcycle_go/utils"

	"github.com/gin-gonic/gin"
)

// EmojiController 表情控制器
type EmojiController struct{}

// NewEmojiController 创建表情控制器实例
func NewEmojiController() *EmojiController {
	return &EmojiController{}
}

// GetEmojis 获取表情列表
// @Summary 获取表情列表
// @Description 获取所有可用的表情
// @Tags emoji
// @Produce json
// @Success 200 {array} utils.EmojiItem
// @Router /api/v1/emojis [get]
func (ec *EmojiController) GetEmojis(c *gin.Context) {
	c.JSON(http.StatusOK, utils.DefaultEmojis)
}

// GetEmojisByCategory 按分类获取表情
// @Summary 按分类获取表情
// @Description 获取指定分类的表情
// @Tags emoji
// @Produce json
// @Param category query string false "分类"
// @Success 200 {array} utils.EmojiItem
// @Router /api/v1/emojis/category [get]
func (ec *EmojiController) GetEmojisByCategory(c *gin.Context) {
	category := c.DefaultQuery("category", "all")

	if category == "all" {
		c.JSON(http.StatusOK, utils.DefaultEmojis)
		return
	}

	emojis := utils.GetEmojisByCategory(category)
	c.JSON(http.StatusOK, emojis)
}

// GetEmojiCategories 获取表情分类
// @Summary 获取表情分类
// @Description 获取所有表情分类
// @Tags emoji
// @Produce json
// @Success 200 {array} string
// @Router /api/v1/emojis/categories [get]
func (ec *EmojiController) GetEmojiCategories(c *gin.Context) {
	categories := utils.GetAllCategories()
	c.JSON(http.StatusOK, categories)
}
