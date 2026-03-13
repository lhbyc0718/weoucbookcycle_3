package models

import (
	"time"

	"gorm.io/gorm"
)

// Notification 通知模型
type Notification struct {
	ID            string         `gorm:"type:varchar(36);primaryKey;comment:通知ID" json:"id"`
	UserID        string         `gorm:"type:varchar(36);index;not null;comment:接收通知的用户ID" json:"user_id"`
	ActorID       string         `gorm:"type:varchar(36);comment:触发者用户ID" json:"actor_id,omitempty"`
	Type          string         `gorm:"type:varchar(50);index;comment:通知类型，例如 initiate,cancel,confirm" json:"type"`
	TransactionID string         `gorm:"type:varchar(36);index;comment:相关交易ID" json:"transaction_id,omitempty"`
	Data          string         `gorm:"type:longtext;comment:通知附加数据(JSON字符串)" json:"data,omitempty"`
	IsRead        bool           `gorm:"default:false;comment:是否已读" json:"is_read"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (Notification) TableName() string {
	return "notifications"
}

// BeforeCreate 创建前自动生成ID
func (n *Notification) BeforeCreate(tx *gorm.DB) error {
	if n.ID == "" {
		n.ID = generateUUID()
	}
	return nil
}
