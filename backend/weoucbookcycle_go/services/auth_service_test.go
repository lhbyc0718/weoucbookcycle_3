package services

import (
	"os"
	"testing"
)

// 示例测试：初始化服务并确保不返回 nil
// 需要设置环境变量以满足配置要求
func TestNewAuthService(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret")
	svc := NewAuthService()
	if svc == nil {
		t.Fatal("expected auth service instance, got nil")
	}
}
