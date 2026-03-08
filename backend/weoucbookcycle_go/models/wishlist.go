package models

import (
	"time"

	"gorm.io/gorm"
)

// Wishlist 收藏夹模型 (独立表优化)
type Wishlist struct {
	ID        string         `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID    string         `gorm:"type:varchar(36);uniqueIndex:idx_user_book;not null" json:"user_id"`
	BookID    string         `gorm:"type:varchar(36);uniqueIndex:idx_user_book;not null" json:"book_id"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联
	Book Book `gorm:"foreignKey:BookID" json:"book,omitempty"`
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// TableName 指定表名
func (Wishlist) TableName() string {
	return "wishlists"
}

// BeforeCreate 创建前钩子
func (w *Wishlist) BeforeCreate(tx *gorm.DB) error {
	if w.ID == "" {
		w.ID = generateUUID()
	}
	return nil
}
