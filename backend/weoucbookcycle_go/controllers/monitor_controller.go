package controllers

import (
	"weoucbookcycle_go/services"
	"weoucbookcycle_go/utils"

	"github.com/gin-gonic/gin"
)

// MonitorController 监控控制器
type MonitorController struct {
	monitorService *services.MonitorService
}

// NewMonitorController 创建监控控制器
func NewMonitorController() *MonitorController {
	return &MonitorController{
		monitorService: services.NewMonitorService(),
	}
}

// GetSystemStats 获取系统统计信息
// @Summary 获取系统统计信息
// @Description 获取当前系统的运行状态（协程数、在线用户、DB连接等）
// @Tags monitor
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {object} services.SystemStats
// @Router /api/v1/monitor/stats [get]
func (mc *MonitorController) GetSystemStats(c *gin.Context) {
	// 简单鉴权：只允许管理员（这里简单判断userID是否为特定值，实际应检查Role）
	// userID := c.GetString("user_id")
	// if !isAdmin(userID) { ... }

	stats := mc.monitorService.GetSystemStats()
	utils.Success(c, stats)
}
