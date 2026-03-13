package models

import (
	"time"

	"gorm.io/gorm"
)

// Transaction 交易记录模型
type Transaction struct {
	ID            string         `gorm:"type:varchar(36);primaryKey;comment:交易ID" json:"id"`
	ListingID     string         `gorm:"type:varchar(36);index;not null;comment:关联发布的ID" json:"listing_id"`
	BuyerID       string         `gorm:"type:varchar(36);index;not null;comment:买家ID" json:"buyer_id"`
	SellerID      string         `gorm:"type:varchar(36);index;not null;comment:卖家ID" json:"seller_id"`
	Amount        float64        `gorm:"type:decimal(10,2);not null;comment:交易金额" json:"amount"`
	Status        string         `gorm:"type:varchar(20);default:pending;comment:pending,completed,cancelled,refunded" json:"status"`
	PaymentMethod string         `gorm:"type:varchar(20);comment:wechat,alipay,offline" json:"payment_method"`
	Note          string         `gorm:"type:text;comment:备注" json:"note,omitempty"`
	CompletedAt   *time.Time     `gorm:"comment:完成时间" json:"completed_at,omitempty"`
	CreatedAt     time.Time      `gorm:"comment:创建时间" json:"created_at"`
	UpdatedAt     time.Time      `gorm:"comment:更新时间" json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	// 评价系统
	Rating     int    `gorm:"default:0;comment:评分(1-5)" json:"rating"`
	Review     string `gorm:"type:text;comment:评价内容" json:"review,omitempty"`
	IsReviewed bool   `gorm:"default:false;comment:是否已评价" json:"is_reviewed"`

	// 关联
	Listing Listing `gorm:"foreignKey:ListingID" json:"listing,omitempty"`
	Buyer   User    `gorm:"foreignKey:BuyerID" json:"buyer,omitempty"`
	Seller  User    `gorm:"foreignKey:SellerID" json:"seller,omitempty"`
}

// Order 订单模型 (扩展 Transaction，用于更复杂的电商逻辑)
type Order struct {
	ID            string         `gorm:"type:varchar(36);primaryKey" json:"id"`
	TransactionID string         `gorm:"type:varchar(36);uniqueIndex" json:"transaction_id"`
	ShippingAddr  string         `gorm:"type:text;comment:收货地址" json:"shipping_address,omitempty"`
	TrackingNo    string         `gorm:"type:varchar(50);comment:物流单号" json:"tracking_no,omitempty"`
	Status        string         `gorm:"type:varchar(20);default:created;comment:created,paid,shipped,received,closed" json:"status"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (Transaction) TableName() string {
	return "transactions"
}

func (Order) TableName() string {
	return "orders"
}

// BeforeCreate 创建前钩子
func (t *Transaction) BeforeCreate(tx *gorm.DB) error {
	if t.ID == "" {
		t.ID = generateUUID()
	}
	return nil
}

func (o *Order) BeforeCreate(tx *gorm.DB) error {
	if o.ID == "" {
		o.ID = generateUUID()
	}
	return nil
}
