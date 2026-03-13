package models

import (
	"time"

	"gorm.io/gorm"
)

// Report 举报模型
type Report struct {
	ID             string         `gorm:"type:varchar(36);primaryKey" json:"id"`
	ReporterID     string         `gorm:"type:varchar(36);index;not null" json:"reporter_id"`
	ReportedUserID string         `gorm:"type:varchar(36);index;not null" json:"reported_user_id"`
	BookID         string         `gorm:"type:varchar(36);index" json:"book_id,omitempty"`
	ListingID      string         `gorm:"type:varchar(36);index" json:"listing_id,omitempty"`
	Reason         string         `gorm:"type:varchar(200)" json:"reason"`
	Details        string         `gorm:"type:text" json:"details,omitempty"`
	Status         string         `gorm:"type:varchar(20);index;default:'pending'" json:"status"` // pending, approved, rejected
	AdminID        string         `gorm:"type:varchar(36);index" json:"admin_id,omitempty"`
	DeductAmount   int            `gorm:"default:0" json:"deduct_amount"`
	CreatedAt      time.Time      `json:"created_at"`
	ResolvedAt     *time.Time     `json:"resolved_at,omitempty"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func (r *Report) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = generateUUID()
	}
	if r.Status == "" {
		r.Status = "pending"
	}
	return nil
}

func (Report) TableName() string {
	return "reports"
}
