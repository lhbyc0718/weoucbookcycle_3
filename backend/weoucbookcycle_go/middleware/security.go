package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// SecurityHeadersMiddleware 设置安全响应头 (CSP, X-Content-Type-Options, etc.)
func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Content-Security-Policy
		// 允许自身源，允许内联脚本(React开发模式需要，生产环境建议移除'unsafe-inline')，允许图片来自自身和data URI
		// connect-src 需要允许 API 地址和 WebSocket 地址
		csp := "default-src 'self'; " +
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'; " + // React/Vite 开发环境通常需要 unsafe-inline/eval
			"style-src 'self' 'unsafe-inline'; " +
			"img-src 'self' data: https:; " + // 允许 https 图片 (如微信头像)
			"font-src 'self' data:; " +
			"connect-src 'self' ws: wss: http: https:;" // 允许 WebSocket 和 API 请求

		c.Header("Content-Security-Policy", csp)
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		c.Next()
	}
}

// CSRFMiddleware 简单的 CSRF 防御
// 检查 Origin/Referer 头是否匹配
func CSRFMiddleware(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 仅对非 GET/HEAD/OPTIONS 请求进行检查
		if c.Request.Method == "GET" || c.Request.Method == "HEAD" || c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		origin := c.Request.Header.Get("Origin")
		referer := c.Request.Header.Get("Referer")

		// 如果没有 Origin 和 Referer，可能是非浏览器请求（如 Postman），暂时放行或根据策略拒绝
		// 在严格模式下，浏览器发起的状态修改请求通常包含 Origin
		if origin == "" && referer == "" {
			// 严格模式可以拒绝: c.AbortWithStatus(http.StatusForbidden)
			c.Next()
			return
		}

		// 检查 Origin
		if origin != "" {
			allowed := false
			for _, o := range allowedOrigins {
				if o == origin {
					allowed = true
					break
				}
			}
			if !allowed {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "CSRF Origin mismatch"})
				return
			}
		}

		// 简单的 Referer 检查 (如果 Origin 不存在)
		// 注意：Referer 可能被伪造或被隐私插件移除
		if origin == "" && referer != "" {
			allowed := false
			for _, o := range allowedOrigins {
				if strings.HasPrefix(referer, o) {
					allowed = true
					break
				}
			}
			if !allowed {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "CSRF Referer mismatch"})
				return
			}
		}

		c.Next()
	}
}
