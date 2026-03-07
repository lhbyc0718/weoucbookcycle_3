package utils

import (
	"context"
	"time"
	"weoucbookcycle_go/config"

	"github.com/redis/go-redis/v9"
)

// RedisLock 分布式锁结构
type RedisLock struct {
	client *redis.Client
	key    string
	value  string
	expiry time.Duration
}

// NewRedisLock 创建分布式锁
func NewRedisLock(key string, expiry time.Duration) *RedisLock {
	return &RedisLock{
		client: config.GetRedisClient(),
		key:    "lock:" + key,
		value:  GenerateUUID(), // 唯一标识，防止误删他人的锁
		expiry: expiry,
	}
}

// Acquire 获取锁
func (l *RedisLock) Acquire(ctx context.Context) (bool, error) {
	if l.client == nil {
		return false, nil // Redis不可用，降级为无锁（或根据业务决定是否报错）
	}

	// SETNX key value
	success, err := l.client.SetNX(ctx, l.key, l.value, l.expiry).Result()
	if err != nil {
		return false, err
	}
	return success, nil
}

// Release 释放锁
func (l *RedisLock) Release(ctx context.Context) error {
	if l.client == nil {
		return nil
	}

	// Lua脚本：保证原子性（只有值匹配才删除）
	script := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("del", KEYS[1])
		else
			return 0
		end
	`
	_, err := l.client.Eval(ctx, script, []string{l.key}, l.value).Result()
	return err
}
