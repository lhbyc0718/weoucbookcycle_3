package middleware

import (
	"net/http"
	"strings"
	"weoucbookcycle_go/config"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware JWT认证中间件
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := ""
		authHeader := c.GetHeader("Authorization")
		
		if authHeader != "" {
			// 提取token
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
			if tokenString == authHeader {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format"})
				c.Abort()
				return
			}
		} else {
			// Try to get from cookie
			if cookie, err := c.Cookie("jwt_token"); err == nil {
				tokenString = cookie
			}
		}

		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header or cookie required"})
			c.Abort()
			return
		}

		// 验证token
		claims, err := config.GetJWTService().ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		// 将用户信息存入context
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("email", claims.Email)
		c.Set("roles", claims.Roles)

		c.Next()
	}
}

// OptionalAuthMiddleware 可选JWT认证中间件
// 如果提供了有效的token，则解析用户信息；否则继续执行但不设置用户信息
func OptionalAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := ""
		authHeader := c.GetHeader("Authorization")

		if authHeader != "" {
			// 提取token
			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenString = strings.TrimPrefix(authHeader, "Bearer ")
			}
		} else {
			// Try to get from cookie
			if cookie, err := c.Cookie("jwt_token"); err == nil {
				tokenString = cookie
			}
		}

		if tokenString != "" {
			// 验证token
			// 如果验证失败，我们只是忽略它，当作未登录用户处理
			claims, err := config.GetJWTService().ValidateToken(tokenString)
			if err == nil {
				// 将用户信息存入context
				c.Set("user_id", claims.UserID)
				c.Set("username", claims.Username)
				c.Set("email", claims.Email)
				c.Set("roles", claims.Roles)
			}
		}

		c.Next()
	}
}
