package models

import (
	"time"

	"gorm.io/gorm"
)

// Address 书籍地址模型（城市、地区等）
type Address struct {
	ID        string         `gorm:"type:varchar(36);primaryKey" json:"id"`
	Province  string         `gorm:"type:varchar(50);index" json:"province"`
	City      string         `gorm:"type:varchar(50);index" json:"city"`
	District  string         `gorm:"type:varchar(50)" json:"district,omitempty"`
	Address   string         `gorm:"type:varchar(255)" json:"address"`             // 详细地址
	Official  bool           `gorm:"default:true;comment:是否为官方地址" json:"official"` // true=官方维护, false=用户自定义
	Creator   string         `gorm:"type:varchar(36);comment:创建者ID，官方地址为空" json:"creator,omitempty"`
	UseCount  int64          `gorm:"default:0;comment:使用次数" json:"use_count"`
	IsActive  bool           `gorm:"default:true;comment:是否启用" json:"is_active"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (Address) TableName() string {
	return "addresses"
}

// BeforeCreate 创建前钩子
func (a *Address) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = generateUUID()
	}
	return nil
}
