package models

import (
	"time"

	"gorm.io/gorm"
)

// Book 书籍模型
type Book struct {
	ID          string         `gorm:"type:varchar(36);primaryKey" json:"id"`
	Title       string         `gorm:"type:varchar(200);not null;index" json:"title"`
	Author      string         `gorm:"type:varchar(100);index" json:"author"`
	ISBN        *string        `gorm:"type:varchar(20);uniqueIndex" json:"isbn,omitempty"` // 指针类型允许NULL
	Category    string         `gorm:"type:varchar(50);index" json:"category"`
	Price       float64        `gorm:"type:decimal(10,2);not null" json:"price"`
	Description string         `gorm:"type:text" json:"description,omitempty"`
	Images      string         `gorm:"type:text;comment:JSON数组字符串" json:"images,omitempty"` // 存储JSON数组
	Condition   string         `gorm:"type:varchar(20);comment:全新,九成新,八成新,七成新,其他" json:"condition"`
	SellerID    string         `gorm:"type:varchar(36);index;not null" json:"seller_id"`
	AddressID   *string        `gorm:"type:varchar(36);index" json:"address_id,omitempty"` // 书籍所在地址
	Status      int            `gorm:"default:1;comment:1=可售,0=已售,2=下架" json:"status"`
	ViewCount   int64          `gorm:"default:0" json:"view_count"`
	LikeCount   int64          `gorm:"default:0" json:"likes"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	Seller   User      `gorm:"foreignKey:SellerID" json:"seller,omitempty"`
	Address  Address   `gorm:"foreignKey:AddressID" json:"address,omitempty"` // 新增地址关联
	Listings []Listing `gorm:"foreignKey:BookID" json:"listings,omitempty"`
}

// 书籍状态常量
const (
	BookStatusSold       = 0 // 已售
	BookStatusAvailable  = 1 // 可售
	BookStatusOffShelf   = 2 // 下架
	BookStatusInProgress = 3 // 交易中（被预定/交易进行中）
)

// TableName 指定表名
func (Book) TableName() string {
	return "books"
}

// BeforeCreate 创建前钩子
func (b *Book) BeforeCreate(tx *gorm.DB) error {
	if b.ID == "" {
		b.ID = generateUUID()
	}
	if b.Images == "" {
		b.Images = "[]"
	}
	return nil
}
