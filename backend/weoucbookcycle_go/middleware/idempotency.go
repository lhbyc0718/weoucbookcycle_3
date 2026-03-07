package middleware

import (
	"net/http"
	"time"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/utils"

	"github.com/gin-gonic/gin"
)

// IdempotencyMiddleware 幂等性中间件
// 通过 X-Idempotency-Key 头防止重复请求
func IdempotencyMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 只针对修改数据的请求
		if c.Request.Method == "GET" || c.Request.Method == "HEAD" || c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		key := c.GetHeader("X-Idempotency-Key")
		if key == "" {
			c.Next()
			return
		}

		// 检查Key是否存在
		redisClient := config.GetRedisClient()
		if redisClient == nil {
			c.Next()
			return
		}

		ctx := c.Request.Context()
		redisKey := "idempotency:" + key

		// 尝试设置Key，如果已存在则返回冲突
		// SETNX key value
		success, err := redisClient.SetNX(ctx, redisKey, "processing", 24*time.Hour).Result()
		if err != nil {
			utils.Error(c, http.StatusInternalServerError, "Idempotency check failed")
			c.Abort()
			return
		}

		if !success {
			// Key已存在，说明是重复请求
			utils.Error(c, http.StatusConflict, "Duplicate request detected")
			c.Abort()
			return
		}

		// 继续处理
		c.Next()

		// 请求处理完成后，可以更新Key的值为结果状态，或者保持现状（简单的去重）
		// 如果处理失败，可能需要删除Key允许重试，这里暂不复杂处理
		if len(c.Errors) > 0 {
			redisClient.Del(ctx, redisKey)
		}
	}
}
