package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// TransactionService 交易服务
type TransactionService struct {
	redis *redis.Client
}

// NewTransactionService 创建TransactionService
func NewTransactionService() *TransactionService {
	return &TransactionService{redis: config.GetRedisClient()}
}

// CreateTransaction 创建交易（发起交易）
func (ts *TransactionService) CreateTransaction(listingID, buyerID, chatID string) (*models.Transaction, error) {
	// 查找发布
	var listing models.Listing
	if err := config.DB.Preload("Book").First(&listing, "id = ?", listingID).Error; err != nil {
		return nil, errors.New("listing not found")
	}

	if listing.Status != "available" {
		return nil, errors.New("listing not available for transaction")
	}

	// 创建交易记录，初始状态为 pending
	// 使用 Omit 排除评价相关字段，防止数据库中尚无这些列时报错 (Error 1054)
	txObj := models.Transaction{
		ListingID: listing.ID,
		BuyerID:   buyerID,
		SellerID:  listing.SellerID,
		Amount:    listing.Price,
		Status:    "pending",
	}

	if err := config.DB.Omit("Rating", "Review", "IsReviewed").Create(&txObj).Error; err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	// 如果提供了 chatID，则在聊天中发送一条 transaction 类型的消息，便于提醒卖家
	if chatID != "" {
		// 获取书籍的第一张图
		var cover string
		var images []string
		if err := json.Unmarshal([]byte(listing.Book.Images), &images); err == nil && len(images) > 0 {
			cover = images[0]
		}

		// 构建简单内容 JSON 字符串，包含更多信息以供前端美化展示
		content := fmt.Sprintf(`{"transaction_id":"%s","listing_id":"%s","book_id":"%s","title":"%s","price":%.2f,"cover":"%s"}`,
			txObj.ID, listing.ID, listing.BookID, listing.Book.Title, listing.Price, cover)

		chatSvc := NewChatService()
		// 忽略错误，尽量发送消息
		chatSvc.SendMessage(chatID, buyerID, content, "transaction")

		// 创建通知给卖家（发起交易）
		// 必须在 if 块内使用 cover 变量，或者将 cover 变量提升到 if 块外
		// 为了修复 undefined: cover 错误，我们将通知逻辑移到这里，或者提取 cover
		ns := NewNotificationService()
		go func() {
			_, _ = ns.CreateNotification(listing.SellerID, "initiate", buyerID, txObj.ID, map[string]interface{}{"listing_id": listing.ID, "title": listing.Book.Title, "price": listing.Price, "cover": cover})
		}()
	} else {
		// 如果没有 chatID，我们也需要发送通知，但 cover 为空
		ns := NewNotificationService()
		go func() {
			_, _ = ns.CreateNotification(listing.SellerID, "initiate", buyerID, txObj.ID, map[string]interface{}{"listing_id": listing.ID, "title": listing.Book.Title, "price": listing.Price, "cover": ""})
		}()
	}

	return &txObj, nil
}

// ReviewTransaction 评价交易
func (ts *TransactionService) ReviewTransaction(txID, userID string, rating int, review string) (*models.Transaction, error) {
	var txObj models.Transaction
	if err := config.DB.First(&txObj, "id = ?", txID).Error; err != nil {
		return nil, errors.New("transaction not found")
	}

	// 只有买家可以评价（当前逻辑，或者允许双方互评，这里先只实现买家评价卖家）
	if txObj.BuyerID != userID {
		return nil, errors.New("only buyer can review transaction")
	}

	if txObj.Status != "completed" {
		return nil, errors.New("transaction not completed")
	}

	if txObj.IsReviewed {
		return nil, errors.New("transaction already reviewed")
	}

	// 开启事务
	err := config.DB.Transaction(func(tx *gorm.DB) error {
		// 1. 更新交易评价
		// 使用 Updates 而不是 Save，避免覆盖其他字段
		if err := tx.Model(&txObj).Updates(map[string]interface{}{
			"rating":      rating,
			"review":      review,
			"is_reviewed": true,
		}).Error; err != nil {
			return err
		}

		// 2. 更新卖家评分统计
		var seller models.User
		// 使用 SELECT FOR UPDATE 锁定卖家记录，防止并发更新导致数据不一致
		if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&seller, "id = ?", txObj.SellerID).Error; err != nil {
			return err
		}

		seller.RatingSum += rating
		seller.RatingCount += 1

		// 3. 同时更新旧的 TrustScore，保持兼容
		// 规则：5分+2，4分+1，3分不变，2分-2，1分-5
		switch rating {
		case 5:
			seller.TrustScore += 2
		case 4:
			seller.TrustScore += 1
		case 2:
			seller.TrustScore -= 2
		case 1:
			seller.TrustScore -= 5
		}
		if seller.TrustScore > 100 {
			seller.TrustScore = 100
		} else if seller.TrustScore < 0 {
			seller.TrustScore = 0
		}

		// 仅更新变更字段
		if err := tx.Model(&seller).Updates(map[string]interface{}{
			"rating_sum":   seller.RatingSum,
			"rating_count": seller.RatingCount,
			"trust_score":  seller.TrustScore,
		}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &txObj, nil
}

// SellerConfirm 卖家确认交易，变为 in_progress 并把 listing 标记为 reserved
func (ts *TransactionService) SellerConfirm(transactionID, sellerID string) (*models.Transaction, error) {
	var txObj models.Transaction
	if err := config.DB.First(&txObj, "id = ?", transactionID).Error; err != nil {
		return nil, errors.New("transaction not found")
	}
	if txObj.SellerID != sellerID {
		return nil, errors.New("no permission to confirm this transaction")
	}
	if txObj.Status != "pending" {
		return nil, errors.New("transaction not in pending state")
	}

	// 更新状态
	txObj.Status = "in_progress"
	if err := config.DB.Save(&txObj).Error; err != nil {
		return nil, fmt.Errorf("failed to update transaction: %w", err)
	}

	// 更新对应的 listing 为 reserved
	var listing models.Listing
	if err := config.DB.First(&listing, "id = ?", txObj.ListingID).Error; err == nil {
		config.DB.Model(&models.Listing{}).Where("id = ?", txObj.ListingID).Updates(map[string]interface{}{
			"status":   "reserved",
			"buyer_id": txObj.BuyerID,
		})
		// 同步更新 Book 状态为 交易中
		config.DB.Model(&models.Book{}).Where("id = ?", listing.BookID).Update("status", models.BookStatusInProgress)
	} else {
		// fallback: 仍然尝试更新 listing
		config.DB.Model(&models.Listing{}).Where("id = ?", txObj.ListingID).Updates(map[string]interface{}{
			"status":   "reserved",
			"buyer_id": txObj.BuyerID,
		})
	}

	// 清除chat中的未读交易标记（如果存在）
	if ts.redis != nil {
		// 查找相关chat(s) - 简单策略：删除所有 chat 中的 unread_tx 对应键（前端会请求具体chat）
		// 这里仅尝试删除可能存在的键模式
		pattern := fmt.Sprintf("unread_tx:*:%s", txObj.ListingID)
		_ = pattern // noop - 保留以便未来扩展
	}

	// 发送系统通知消息到聊天室
	go func() {
		chatID := ts.findChatID(txObj.BuyerID, txObj.SellerID)
		if chatID != "" {
			chatSvc := NewChatService()
			chatSvc.SendMessage(chatID, sellerID, "已接受交易请求，等待买家收书", "text")
		}
	}()

	// 发布通知给买家：卖家已确认
	go func() {
		ns := NewNotificationService()
		// attach listing info if possible
		_, _ = ns.CreateNotification(txObj.BuyerID, "confirm", sellerID, txObj.ID, map[string]interface{}{"listing_id": txObj.ListingID})
	}()

	return &txObj, nil
}

// BuyerConfirmReceipt 买家确认收到货，交易完成
func (ts *TransactionService) BuyerConfirmReceipt(transactionID, buyerID string) (*models.Transaction, error) {
	var txObj models.Transaction
	if err := config.DB.First(&txObj, "id = ?", transactionID).Error; err != nil {
		return nil, errors.New("transaction not found")
	}
	if txObj.BuyerID != buyerID {
		return nil, errors.New("no permission to confirm receipt for this transaction")
	}
	if txObj.Status != "in_progress" {
		return nil, errors.New("transaction not in progress")
	}

	now := time.Now()
	txObj.Status = "completed"
	txObj.CompletedAt = &now
	if err := config.DB.Save(&txObj).Error; err != nil {
		return nil, fmt.Errorf("failed to complete transaction: %w", err)
	}

	// 更新 listing 为 sold，并同步更新 Book 为已售
	var listing models.Listing
	if err := config.DB.First(&listing, "id = ?", txObj.ListingID).Error; err == nil {
		config.DB.Model(&models.Listing{}).Where("id = ?", txObj.ListingID).Updates(map[string]interface{}{
			"status": "sold",
		})
		config.DB.Model(&models.Book{}).Where("id = ?", listing.BookID).Update("status", models.BookStatusSold)
	} else {
		config.DB.Model(&models.Listing{}).Where("id = ?", txObj.ListingID).Updates(map[string]interface{}{
			"status": "sold",
		})
	}

	// 发布通知到 Redis（可被 websocket 或前端订阅）
	if ts.redis != nil {
		ts.redis.Publish(context.Background(), "transaction:completed", txObj.ID)
	}

	// 通知卖家：买家已确认收书（交易完成）
	go func() {
		ns := NewNotificationService()
		_, _ = ns.CreateNotification(txObj.SellerID, "confirm", buyerID, txObj.ID, map[string]interface{}{"listing_id": txObj.ListingID})
	}()

	// 发送系统通知消息到聊天室
	go func() {
		chatID := ts.findChatID(txObj.BuyerID, txObj.SellerID)
		if chatID != "" {
			chatSvc := NewChatService()
			chatSvc.SendMessage(chatID, buyerID, "已确认收书，交易完成", "text")
		}
	}()

	return &txObj, nil
}

// findChatID 寻找两个用户之间的聊天ID
func (ts *TransactionService) findChatID(u1, u2 string) string {
	var chatID string
	err := config.DB.Raw(`
		SELECT c.id FROM chats c
		JOIN chat_users cu1 ON c.id = cu1.chat_id AND cu1.user_id = ?
		JOIN chat_users cu2 ON c.id = cu2.chat_id AND cu2.user_id = ?
		LIMIT 1
	`, u1, u2).Scan(&chatID).Error
	if err != nil {
		return ""
	}
	return chatID
}

// CancelTransaction 任一方取消交易
func (ts *TransactionService) CancelTransaction(transactionID, userID string) (*models.Transaction, error) {
	var txObj models.Transaction
	if err := config.DB.First(&txObj, "id = ?", transactionID).Error; err != nil {
		return nil, errors.New("transaction not found")
	}
	// 只有买家或卖家可以取消
	if txObj.BuyerID != userID && txObj.SellerID != userID {
		return nil, errors.New("no permission to cancel this transaction")
	}
	if txObj.Status == "completed" || txObj.Status == "cancelled" {
		return nil, errors.New("transaction cannot be cancelled")
	}

	txObj.Status = "cancelled"
	if err := config.DB.Save(&txObj).Error; err != nil {
		return nil, fmt.Errorf("failed to cancel transaction: %w", err)
	}

	// 恢复 listing 为 available，并将 Book 状态恢复为可售
	var listing models.Listing
	if err := config.DB.First(&listing, "id = ?", txObj.ListingID).Error; err == nil {
		config.DB.Model(&models.Listing{}).Where("id = ?", txObj.ListingID).Updates(map[string]interface{}{
			"status":   "available",
			"buyer_id": nil, // 使用 nil 映射到数据库 NULL
		})
		config.DB.Model(&models.Book{}).Where("id = ?", listing.BookID).Update("status", models.BookStatusAvailable)
	} else {
		config.DB.Model(&models.Listing{}).Where("id = ?", txObj.ListingID).Updates(map[string]interface{}{
			"status":   "available",
			"buyer_id": nil,
		})
	}

	// 发送系统通知消息到聊天室
	go func() {
		chatID := ts.findChatID(txObj.BuyerID, txObj.SellerID)
		if chatID != "" {
			chatSvc := NewChatService()
			chatSvc.SendMessage(chatID, userID, "已取消交易", "text")
		}
	}()

	// 通知对方：交易已取消
	go func() {
		other := txObj.BuyerID
		if other == userID {
			other = txObj.SellerID
		}
		ns := NewNotificationService()
		_, _ = ns.CreateNotification(other, "cancel", userID, txObj.ID, map[string]interface{}{"listing_id": txObj.ListingID})
	}()

	return &txObj, nil
}

// GetMyTransactions 获取当前用户的交易记录（作为买家或卖家）
func (ts *TransactionService) GetMyTransactions(userID string) ([]models.Transaction, error) {
	var txs []models.Transaction
	if err := config.DB.Preload("Listing.Book").Where("buyer_id = ? OR seller_id = ?", userID, userID).Order("created_at desc").Find(&txs).Error; err != nil {
		return nil, fmt.Errorf("failed to get transactions: %w", err)
	}
	return txs, nil
}

// GetTransactionByID 根据id获取交易详情
func (ts *TransactionService) GetTransactionByID(id string) (*models.Transaction, error) {
	var tx models.Transaction
	if err := config.DB.Preload("Listing.Book").Preload("Buyer").Preload("Seller").First(&tx, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("transaction not found: %w", err)
	}
	return &tx, nil
}
