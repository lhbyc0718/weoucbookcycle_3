package controllers

import (
	"time"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"
	"weoucbookcycle_go/utils"

	"github.com/gin-gonic/gin"
)

// ReportController 举报控制器
type ReportController struct{}

func NewReportController() *ReportController {
	return &ReportController{}
}

// CreateReportRequest 提交举报
type CreateReportRequest struct {
	ReportedUserID string `json:"reported_user_id" binding:"required"`
	BookID         string `json:"book_id"`
	ListingID      string `json:"listing_id"`
	Reason         string `json:"reason" binding:"required"`
	Details        string `json:"details"`
}

// CreateReport 用户发起举报
func (rc *ReportController) CreateReport(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		utils.Error(c, utils.CodeUnauthorized, "unauthorized")
		return
	}

	var req CreateReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	report := models.Report{
		ReporterID:     userID,
		ReportedUserID: req.ReportedUserID,
		BookID:         req.BookID,
		ListingID:      req.ListingID,
		Reason:         req.Reason,
		Details:        req.Details,
		Status:         "pending",
	}

	if err := config.DB.Create(&report).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to create report: "+err.Error())
		return
	}

	utils.SuccessWithMessage(c, "Report submitted", report)
}

// ListReports 管理员查看举报列表（可带 status 过滤）
func (rc *ReportController) ListReports(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		utils.Error(c, utils.CodeUnauthorized, "unauthorized")
		return
	}

	// 仅管理员可查看
	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil || user.Role != "admin" {
		utils.Error(c, utils.CodeForbidden, "Only admins can view reports")
		return
	}

	status := c.Query("status")
	query := config.DB.Model(&models.Report{})
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var reports []models.Report
	if err := query.Order("created_at DESC").Find(&reports).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to list reports: "+err.Error())
		return
	}

	utils.Success(c, gin.H{"reports": reports})
}

// ResolveReportRequest 管理员审核请求
type ResolveReportRequest struct {
	Action       string `json:"action" binding:"required"` // approve or reject
	DeductPoints int    `json:"deduct_points"`
	Note         string `json:"note"`
}

// ResolveReport 管理员处理举报，批准则扣除信任分
func (rc *ReportController) ResolveReport(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		utils.Error(c, utils.CodeUnauthorized, "unauthorized")
		return
	}

	// 仅管理员可操作
	var admin models.User
	if err := config.DB.First(&admin, "id = ?", userID).Error; err != nil || admin.Role != "admin" {
		utils.Error(c, utils.CodeForbidden, "Only admins can resolve reports")
		return
	}

	reportID := c.Param("id")
	var report models.Report
	if err := config.DB.First(&report, "id = ?", reportID).Error; err != nil {
		utils.Error(c, utils.CodeNotFound, "Report not found")
		return
	}

	var req ResolveReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	if report.Status != "pending" {
		utils.Error(c, utils.CodeValidationError, "Report already resolved")
		return
	}

	now := time.Now()

	if req.Action == "approve" {
		// 扣除被举报用户的 trust score
		var reported models.User
		if err := config.DB.First(&reported, "id = ?", report.ReportedUserID).Error; err != nil {
			utils.Error(c, utils.CodeNotFound, "Reported user not found")
			return
		}

		deduct := req.DeductPoints
		if deduct < 0 {
			deduct = 0
		}

		reported.TrustScore -= deduct
		if reported.TrustScore < 0 {
			reported.TrustScore = 0
		}
		if reported.TrustScore > 100 {
			reported.TrustScore = 100
		}

		// 事务更新
		tx := config.DB.Begin()
		if err := tx.Model(&reported).Update("trust_score", reported.TrustScore).Error; err != nil {
			tx.Rollback()
			utils.Error(c, utils.CodeInternalServerError, "Failed to deduct trust score: "+err.Error())
			return
		}

		report.Status = "approved"
		report.AdminID = admin.ID
		report.DeductAmount = deduct
		report.ResolvedAt = &now

		if err := tx.Save(&report).Error; err != nil {
			tx.Rollback()
			utils.Error(c, utils.CodeInternalServerError, "Failed to update report: "+err.Error())
			return
		}

		tx.Commit()
		utils.SuccessWithMessage(c, "Report approved and trust score updated", gin.H{"report": report})
		return
	}

	if req.Action == "reject" {
		report.Status = "rejected"
		report.AdminID = admin.ID
		report.ResolvedAt = &now
		if err := config.DB.Save(&report).Error; err != nil {
			utils.Error(c, utils.CodeInternalServerError, "Failed to update report: "+err.Error())
			return
		}
		utils.SuccessWithMessage(c, "Report rejected", gin.H{"report": report})
		return
	}

	utils.Error(c, utils.CodeValidationError, "invalid action")
}

// AdminCreateUserRole 简单接口：管理员设置某用户为 admin 或 user
func (rc *ReportController) AdminSetUserRole(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		utils.Error(c, utils.CodeUnauthorized, "unauthorized")
		return
	}

	var admin models.User
	if err := config.DB.First(&admin, "id = ?", userID).Error; err != nil || admin.Role != "admin" {
		utils.Error(c, utils.CodeForbidden, "Only admins can set roles")
		return
	}

	targetID := c.Param("id")
	var body struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	if body.Role != "admin" && body.Role != "user" {
		utils.Error(c, utils.CodeValidationError, "role must be 'admin' or 'user'")
		return
	}

	if err := config.DB.Model(&models.User{}).Where("id = ?", targetID).Update("role", body.Role).Error; err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to update role: "+err.Error())
		return
	}

	utils.SuccessWithMessage(c, "Role updated", nil)
}
