package utils

import (
	"bytes"
	"encoding/base64"
	"fmt"

	"github.com/dchest/captcha"
)

// InitCaptcha 初始化Captcha配置
// 建议在应用启动时调用
func InitCaptcha() {
	// 增加图片复杂度
	// 设置图片尺寸和字符长度（默认为6）
	// captcha.SetCustomStore(captcha.NewMemoryStore(1000, 10*time.Minute))
}

// GenerateCaptcha 生成图形验证码
// 返回: id (验证码ID), b64s (Base64编码的图片), error
func GenerateCaptcha() (string, string, error) {
	// 生成6位数字验证码
	id := captcha.NewLen(6)

	// 调整图片尺寸为更宽更高，以容纳更多噪点和干扰线
	var buf bytes.Buffer
	// width: 240, height: 80
	// NewImage 默认使用黑色背景，白色文字
	// 为了增加辨识度和美观，我们可以不直接使用WriteImage，而是NewImage后自定义输出
	// 但WriteImage对于默认需求已经足够，如果空白可能是前端渲染问题或者base64拼接问题
	// 确保前端正确处理了 data:image/png;base64, 前缀
	if err := captcha.WriteImage(&buf, id, 240, 80); err != nil {
		return "", "", err
	}

	b64s := base64.StdEncoding.EncodeToString(buf.Bytes())
	// 返回 Data URI Scheme 格式
	return id, fmt.Sprintf("data:image/png;base64,%s", b64s), nil
}

// VerifyCaptcha 验证图形验证码
// id: 验证码ID
// digits: 用户输入的数字
func VerifyCaptcha(id string, digits string) bool {
	// 验证Captcha
	// 注意：dchest/captcha 默认存储在内存中。如果服务器重启，验证码将丢失。
	// 在生产环境中，应该使用 Redis 或其他持久化存储。
	// 这里为了简单，我们假设是单机部署，且不重启。
	if id == "" || digits == "" {
		return false
	}

	// 如果是开发环境，允许万能验证码 (仅用于测试)
	// if digits == "000000" { return true }

	return captcha.VerifyString(id, digits)
}

// StoreCaptcha 供测试或特殊用途手动存储验证码（一般不需要，New()会自动存储）
func StoreCaptcha(id string, digits []byte) {
	// dchest/captcha 的 Store 接口是私有的或者通过全局 SetCustomStore 设置
	// 这里通常不需要手动操作，除非使用自定义存储后端（如Redis）
}
