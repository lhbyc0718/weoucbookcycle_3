package models

import "time"

// Block 表示用户拉黑关系（blocker 拉黑 blocked）
type Block struct {
	ID        string    `gorm:"type:varchar(36);primaryKey" json:"id"`
	BlockerID string    `gorm:"type:varchar(36);index;not null" json:"blocker_id"`
	BlockedID string    `gorm:"type:varchar(36);index;not null" json:"blocked_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (Block) TableName() string {
	return "blocks"
}
