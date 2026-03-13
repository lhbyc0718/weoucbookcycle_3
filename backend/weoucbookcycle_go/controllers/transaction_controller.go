package controllers

import (
	"context"
	"net/http"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/services"
	"weoucbookcycle_go/utils"

	"github.com/gin-gonic/gin"
)

// TransactionController 交易控制器
type TransactionController struct{}

// NewTransactionController 创建实例
func NewTransactionController() *TransactionController {
	return &TransactionController{}
}

// CreateTransaction 发起交易
func (tc *TransactionController) CreateTransaction(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		utils.Unauthorized(c, "")
		return
	}

	var body struct {
		ListingID string `json:"listing_id" binding:"required"`
		ChatID    string `json:"chat_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	txSvc := services.NewTransactionService()
	txObj, err := txSvc.CreateTransaction(body.ListingID, userID, body.ChatID)
	if err != nil {
		utils.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	utils.Success(c, txObj)
}

// ConfirmBySeller 卖家确认交易
func (tc *TransactionController) ConfirmBySeller(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		utils.Unauthorized(c, "")
		return
	}
	id := c.Param("id")
	txSvc := services.NewTransactionService()
	txObj, err := txSvc.SellerConfirm(id, userID)
	if err != nil {
		utils.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	utils.Success(c, txObj)
}

// ConfirmReceipt 买家确认收书
func (tc *TransactionController) ConfirmReceipt(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		utils.Unauthorized(c, "")
		return
	}
	id := c.Param("id")
	txSvc := services.NewTransactionService()
	txObj, err := txSvc.BuyerConfirmReceipt(id, userID)
	if err != nil {
		utils.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	utils.Success(c, txObj)
}

// CancelTransaction 取消交易
func (tc *TransactionController) CancelTransaction(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		utils.Unauthorized(c, "")
		return
	}
	id := c.Param("id")
	txSvc := services.NewTransactionService()
	txObj, err := txSvc.CancelTransaction(id, userID)
	if err != nil {
		utils.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	utils.Success(c, txObj)
}

// ReviewTransactionRequest 评价交易请求
type ReviewTransactionRequest struct {
	Rating int    `json:"rating" binding:"required,min=1,max=5"`
	Review string `json:"review" binding:"max=500"`
}

// ReviewTransaction 评价交易
func (tc *TransactionController) ReviewTransaction(c *gin.Context) {
	txID := c.Param("id")
	userID := c.GetString("user_id")

	var req ReviewTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	txSvc := services.NewTransactionService()
	txObj, err := txSvc.ReviewTransaction(txID, userID, req.Rating, req.Review)
	if err != nil {
		utils.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	utils.Success(c, txObj)
}

// GetMyTransactions 获取我的交易
func (tc *TransactionController) GetMyTransactions(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		utils.Unauthorized(c, "")
		return
	}

	txSvc := services.NewTransactionService()
	txs, err := txSvc.GetMyTransactions(userID)
	if err != nil {
		utils.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, txs)
}

// GetTransaction 获取单个交易详情（仅卖家或买家可查看）
func (tc *TransactionController) GetTransaction(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		utils.Unauthorized(c, "")
		return
	}
	id := c.Param("id")
	txSvc := services.NewTransactionService()
	tx, err := txSvc.GetTransactionByID(id)
	if err != nil {
		utils.Error(c, http.StatusNotFound, err.Error())
		return
	}

	// 权限检查：只有交易的买家或卖家可以查看
	if tx.BuyerID != userID && tx.SellerID != userID {
		utils.Error(c, http.StatusForbidden, "no permission to view this transaction")
		return
	}

	utils.Success(c, tx)
}

// ClearUnread 清除当前用户所有聊天中的交易未读标记
func (tc *TransactionController) ClearUnread(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		utils.Unauthorized(c, "")
		return
	}

	// 删除 Redis 中所有匹配 unread_tx:<userID>:* 的键
	if config.RedisClient == nil {
		// 如果没有 Redis，直接返回成功
		c.JSON(http.StatusOK, gin.H{"cleared": true})
		return
	}

	pattern := "unread_tx:" + userID + ":*"
	ctx := context.Background()
	keys, err := config.RedisClient.Keys(ctx, pattern).Result()
	if err != nil {
		// 如果查询失败，记录但返回成功以免影响用户体验
		c.JSON(http.StatusOK, gin.H{"cleared": false, "error": err.Error()})
		return
	}
	if len(keys) > 0 {
		_, _ = config.RedisClient.Del(ctx, keys...).Result()
	}

	c.JSON(http.StatusOK, gin.H{"cleared": true})
}

// GetUnread 返回当前用户的交易未读数量
func (tc *TransactionController) GetUnread(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		utils.Unauthorized(c, "")
		return
	}

	if config.RedisClient == nil {
		c.JSON(http.StatusOK, gin.H{"unread_tx": 0})
		return
	}

	ctx := context.Background()
	pattern := "unread_tx:" + userID + ":*"
	keys, err := config.RedisClient.Keys(ctx, pattern).Result()
	if err != nil {
		// 返回 0 而不是错误，避免前端抛出异常
		c.JSON(http.StatusOK, gin.H{"unread_tx": 0})
		return
	}

	c.JSON(http.StatusOK, gin.H{"unread_tx": len(keys)})
}
