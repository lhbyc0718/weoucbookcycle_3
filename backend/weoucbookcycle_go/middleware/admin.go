package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// AdminMiddleware 管理员权限中间件
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		roles, exists := c.Get("roles")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: No roles found"})
			c.Abort()
			return
		}

		// 检查是否有 admin 角色
		roleList, ok := roles.([]string)
		if !ok {
			// 兼容旧的单一角色逻辑（如果有）
			roleStr, ok := roles.(string)
			if ok && roleStr == "admin" {
				c.Next()
				return
			}
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: Invalid role format"})
			c.Abort()
			return
		}

		isAdmin := false
		for _, role := range roleList {
			if role == "admin" {
				isAdmin = true
				break
			}
		}

		if !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: Admin role required"})
			c.Abort()
			return
		}

		c.Next()
	}
}
