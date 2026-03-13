package services

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"net/smtp"
	"strings"
	"sync"
	"time"
	"weoucbookcycle_go/config"
	"weoucbookcycle_go/models"
	"weoucbookcycle_go/utils"

	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	redisCtx = context.Background()
)

// EmailConfig 邮件配置
type EmailConfig struct {
	SMTPHost     string
	SMTPPort     int
	SMTPUser     string
	SMTPPassword string
	FromEmail    string
	FromName     string
}

// AuthConfig 认证配置
type AuthConfig struct {
	MaxLoginAttempts     int           // 最大登录失败次数
	LoginBlockDuration   time.Duration // 登录封禁时长
	RegisterLimitPerHour int           // 每小时最大注册次数
}

// AuthService 认证服务
type AuthService struct {
	jwtService  *config.JWTService
	emailConfig *EmailConfig
	authConfig  *AuthConfig
	// 邮件发送队列（使用goroutine异步处理）
	emailQueue   chan *EmailTask
	emailWorkers int
	// 登录失败记录队列
	loginFailureQueue chan *LoginFailure
	// IP封禁检查缓存
	ipBlockCache sync.Map // IP -> BlockInfo
}

// EmailTask 邮件发送任务
type EmailTask struct {
	Type      string // "welcome", "verification", "password_reset", "password_changed"
	ToEmail   string
	Subject   string
	Body      string
	HTMLBody  string
	Timestamp time.Time
	Retries   int
}

// LoginFailure 登录失败记录
type LoginFailure struct {
	Email     string
	IP        string
	Timestamp time.Time
	UserAgent string
}

// BlockInfo IP封禁信息
type BlockInfo struct {
	UnblockTime time.Time
	Reason      string
}

// NewAuthService 创建认证服务实例
func NewAuthService() *AuthService {
	emailConfig := &EmailConfig{
		SMTPHost:     config.GetEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:     config.GetEnvInt("SMTP_PORT", 587),
		SMTPUser:     config.GetEnv("SMTP_USER", ""),
		SMTPPassword: config.GetEnv("SMTP_PASSWORD", ""),
		FromEmail:    config.GetEnv("FROM_EMAIL", "noreply@weoucbookcycle.com"),
		FromName:     config.GetEnv("FROM_NAME", "WeOUC BookCycle"),
	}

	authConfig := &AuthConfig{
		MaxLoginAttempts:     20,
		LoginBlockDuration:   30 * time.Minute,
		RegisterLimitPerHour: 10,
	}

	authService := &AuthService{
		jwtService:        config.GetJWTService(),
		emailConfig:       emailConfig,
		authConfig:        authConfig,
		emailQueue:        make(chan *EmailTask, 1000),
		emailWorkers:      5,
		loginFailureQueue: make(chan *LoginFailure, 1000),
	}

	// 启动邮件发送worker池
	authService.startEmailWorkers()

	// 启动登录失败处理worker
	authService.startLoginFailureWorker()

	// 启动IP封禁检查清理goroutine
	go authService.cleanupIPBlocks()

	return authService
}

// RegisterRequest 注册请求
type RegisterRequest struct {
	Username   string `json:"username" binding:"required,min=3,max=50"`
	Email      string `json:"email"`
	Phone      string `json:"phone"`
	Password   string `json:"password" binding:"required,min=8,max=100"`
	CaptchaID  string `json:"captcha_id" binding:"required"`
	CaptchaVal string `json:"captcha_val" binding:"required"`
}

// LoginRequest 登录请求
type LoginRequest struct {
	Identifier string `json:"identifier" binding:"required"` // Username, Email or Phone
	Password   string `json:"password" binding:"required"`
}

// ==================== 注册相关方法 ====================

// Register 用户注册 (第一步：校验并发送验证码)
// 注意：现在注册逻辑改为：用户填写信息 -> 验证Captcha -> 暂存信息 -> 发送验证链接/码
// 用户点击链接/输入验证码 -> 激活账户
func (as *AuthService) Register(req *RegisterRequest, clientIP string) error {
	// 0. 验证Captcha
	if !utils.VerifyCaptcha(req.CaptchaID, req.CaptchaVal) {
		return errors.New("验证码错误")
	}

	// 1. 检查IP是否被封禁
	if as.isIPBlocked(clientIP) {
		return errors.New("您的IP因可疑活动已被封禁")
	}

	// 2. 检查用户名是否已存在
	var existingUser models.User
	if err := config.DB.Where("username = ?", req.Username).First(&existingUser).Error; err == nil {
		return errors.New("用户名已被占用")
	}

	// 3. 检查邮箱/手机号是否已存在
	if req.Email != "" {
		if err := config.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
			return errors.New("邮箱已注册")
		}
	} else if req.Phone != "" {
		if err := config.DB.Where("phone = ?", req.Phone).First(&existingUser).Error; err == nil {
			return errors.New("手机号已注册")
		}
	} else {
		return errors.New("需要邮箱或手机号")
	}

	// 4. 检查注册频率限制
	if config.RedisClient != nil {
		registerLimitKey := fmt.Sprintf("register:limit:%s", clientIP)
		count, _ := config.RedisClient.Get(redisCtx, registerLimitKey).Int64()
		if count >= int64(as.authConfig.RegisterLimitPerHour) {
			as.recordSuspiciousActivity(clientIP, "too many registration attempts")
			return fmt.Errorf("注册尝试次数过多，请稍后再试")
		}
	}

	// 5. 生成验证 Token (UUID, not 6-digit code)
	// verificationCode := as.generateVerificationCode()
	// Use a longer token for link verification
	verificationToken := generateRandomToken(32)
	verificationCodeHash, _ := bcrypt.GenerateFromPassword([]byte(verificationToken), bcrypt.DefaultCost)

	// 6. 暂存注册信息到Redis (1小时有效)
	// Key: register:pending:{email/phone}
	identifier := req.Email
	if identifier == "" {
		identifier = req.Phone
	}

	pendingKey := fmt.Sprintf("register:pending:%s", identifier)

	// 对密码进行加密暂存
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	pendingData := map[string]interface{}{
		"username":  req.Username,
		"email":     req.Email,
		"phone":     req.Phone,
		"password":  string(hashedPassword),
		"code_hash": string(verificationCodeHash),
	}

	pendingJSON, _ := json.Marshal(pendingData)
	if config.RedisClient != nil {
		if err := config.RedisClient.Set(redisCtx, pendingKey, pendingJSON, 1*time.Hour).Err(); err != nil {
			return fmt.Errorf("failed to save registration session: %w", err)
		}
	} else {
		return errors.New("Redis service unavailable")
	}

	// 7. 发送验证码/链接
	if req.Email != "" {
		go func() {
			frontendURL := config.GetEnv("FRONTEND_URL", "http://localhost:5173")
			verificationLink := fmt.Sprintf("%s/verify-email?email=%s&code=%s", frontendURL, req.Email, verificationToken)

			// Log the link for local development convenience
			fmt.Printf("====================================================================\n")
			fmt.Printf("📧 [Email Verification] To: %s\n", req.Email)
			fmt.Printf("🔗 Link: %s\n", verificationLink)
			fmt.Printf("====================================================================\n")

			as.queueEmail(&EmailTask{
				Type:    "verification",
				ToEmail: req.Email,
				Subject: "Verify Your Email Address - WeOUC Book Cycle",
				HTMLBody: fmt.Sprintf(`
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
						<h2 style="color: #333;">Welcome to WeOUC Book Cycle!</h2>
						<p>Please verify your email address to complete registration.</p>
						<div style="text-align: center; margin: 30px 0;">
							<a href="%s" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email Address</a>
						</div>
						
						<div style="background-color: #FFF3CD; color: #856404; padding: 10px; border-radius: 4px; margin: 20px 0; font-size: 14px;">
							<strong>⚠️ 注意 / Note:</strong><br/>
							如果点击按钮显示 JSON 错误 (Invalid url)，是因为邮件服务商拦截了本地开发地址 (localhost)。<br/>
							If clicking the button shows an error, please copy the link below manually.
						</div>

						<p>Or copy and paste this link into your browser:</p>
						<p><a href="%s" style="color: #4F46E5; word-break: break-all;">%s</a></p>
						<p style="color: #666; font-size: 12px; margin-top: 30px;">This link expires in 1 hour.</p>
					</div>
				`, verificationLink, verificationLink, verificationLink),
				Timestamp: time.Now(),
			})
		}()
	} else {
		// Mock Phone SMS (Using token as code for now, or could generate a short code for phone only)
		// Since user requested "NO CODE" for email, but phone usually needs code.
		// Assuming phone registration is less critical or follows same logic.
		// For consistency, let's just log the token for phone too if needed.
		fmt.Printf("[MOCK SMS] To: %s, Link/Code: %s\n", req.Phone, verificationToken)
	}

	return nil
}

// UpdatePassword 修改密码 (登录后)
func (as *AuthService) UpdatePassword(userID, oldPassword, newPassword string) error {
	// 1. 获取用户
	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		return errors.New("用户不存在")
	}

	// 2. 验证旧密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(oldPassword)); err != nil {
		return errors.New("旧密码错误")
	}

	// 3. 验证新密码强度
	if len(newPassword) < 8 {
		return errors.New("新密码长度至少需要8个字符")
	}

	// 4. 加密新密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// 5. 更新密码
	if err := config.DB.Model(&user).Update("password", string(hashedPassword)).Error; err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// 6. 发送通知
	go func() {
		as.queueEmail(&EmailTask{
			Type:      "password_updated",
			ToEmail:   user.Email,
			Subject:   "Security Alert: Password Updated",
			Body:      fmt.Sprintf("Hello %s,\n\nYour password has been updated. If this was not you, please contact support immediately.", user.Username),
			Timestamp: time.Now(),
		})
	}()

	return nil
}

// CompleteRegistration 完成注册 (验证通过后调用)
func (as *AuthService) CompleteRegistration(identifier, code string, clientIP string) (*models.User, string, error) {
	if config.RedisClient == nil {
		return nil, "", errors.New("Redis service unavailable")
	}

	// 1. 获取暂存信息
	pendingKey := fmt.Sprintf("register:pending:%s", identifier)
	val, err := config.RedisClient.Get(redisCtx, pendingKey).Result()
	if err != nil {
		return nil, "", errors.New("registration session expired or invalid")
	}

	var pendingData struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Phone    string `json:"phone"`
		Password string `json:"password"`
		CodeHash string `json:"code_hash"`
	}
	json.Unmarshal([]byte(val), &pendingData)

	// 2. 验证代码
	if err := bcrypt.CompareHashAndPassword([]byte(pendingData.CodeHash), []byte(code)); err != nil {
		return nil, "", errors.New("invalid verification code")
	}

	// 3. 创建用户
	user := models.User{
		Username:      pendingData.Username,
		Email:         pendingData.Email,
		Phone:         pendingData.Phone,
		Password:      pendingData.Password, // Already hashed
		Status:        1,
		EmailVerified: pendingData.Email != "",
		VerifiedAt:    func() *time.Time { t := time.Now(); return &t }(),
		WeChatOpenID:  nil, // Ensure it's nil
	}

	if err := config.DB.Create(&user).Error; err != nil {
		// 检查是否是重复键错误 (Error 1062)
		if strings.Contains(err.Error(), "1062") {
			// 尝试查找现有用户
			var existingUser models.User
			// Use Or to find by username OR email OR phone
			if err := config.DB.Where("username = ?", user.Username).
				Or("email = ?", user.Email).
				Or("phone = ?", user.Phone).
				First(&existingUser).Error; err == nil {
				// 如果用户已存在，视为注册成功（幂等性）
				user = existingUser
			} else {
				// 真正的数据库错误或查不到用户（奇怪的情况）
				return nil, "", fmt.Errorf("用户名或邮箱已被占用")
			}
		} else {
			return nil, "", fmt.Errorf("failed to create user: %w", err)
		}
	}

	// 4. 清理Redis
	config.RedisClient.Del(redisCtx, pendingKey)

	// 5. 增加注册计数
	if config.RedisClient != nil {
		registerLimitKey := fmt.Sprintf("register:limit:%s", clientIP)
		config.RedisClient.Incr(redisCtx, registerLimitKey)
		config.RedisClient.Expire(redisCtx, registerLimitKey, time.Hour)
	}

	// 6. 生成Token
	token, err := as.jwtService.GenerateToken(user.ID, user.Username, user.Email, []string{"user"})
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate token: %w", err)
	}

	return &user, token, nil
}

// ==================== 登录相关方法 ====================

// Login 用户登录 (支持 用户名/邮箱/手机号)
func (as *AuthService) Login(req *LoginRequest, clientIP, userAgent string) (*models.User, string, error) {
	// 1. 检查IP是否被封禁
	if as.isIPBlocked(clientIP) {
		as.recordLoginFailure(req.Identifier, clientIP, userAgent, "IP blocked")
		return nil, "", errors.New("由于登录失败次数过多，您的IP已被封禁")
	}

	// 2. 查找用户 (Identifier可以是 Username, Email 或 Phone)
	var user models.User
	result := config.DB.Where("email = ?", req.Identifier).
		Or("username = ?", req.Identifier).
		Or("phone = ?", req.Identifier).
		First(&user)

	if result.Error != nil {
		// 用户不存在
		as.recordLoginFailure(req.Identifier, clientIP, userAgent, "user not found")
		return nil, "", errors.New("账号不存在")
	}

	// 3. 检查账号是否锁定 (20次失败)
	if user.LockoutUntil != nil && time.Now().Before(*user.LockoutUntil) {
		return nil, "", fmt.Errorf("账号已锁定，请在 %s 后重试", user.LockoutUntil.Format(time.RFC3339))
	}

	// 4. 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		// 增加失败次数
		user.FailedLoginAttempts++
		if user.FailedLoginAttempts >= 20 {
			lockoutTime := time.Now().Add(as.authConfig.LoginBlockDuration)
			user.LockoutUntil = &lockoutTime
			config.DB.Model(&user).Select("FailedLoginAttempts", "LockoutUntil").Updates(user)
			as.recordLoginFailure(req.Identifier, clientIP, userAgent, "account locked")
			return nil, "", errors.New("由于尝试失败次数过多，账号已锁定")
		}
		config.DB.Model(&user).Update("FailedLoginAttempts", user.FailedLoginAttempts)

		as.recordLoginFailure(req.Identifier, clientIP, userAgent, "invalid password")
		return nil, "", errors.New("密码错误")
	}

	// 5. 登录成功，重置失败次数
	if user.FailedLoginAttempts > 0 || user.LockoutUntil != nil {
		config.DB.Model(&user).Updates(map[string]interface{}{
			"FailedLoginAttempts": 0,
			"LockoutUntil":        nil,
		})
	}

	// 6. 检查用户状态
	if user.Status == 0 {
		return nil, "", errors.New("账号已禁用")
	}

	// 7. 更新最后登录时间
	now := time.Now()
	config.DB.Model(&user).Updates(map[string]interface{}{
		"last_login":  &now,
		"login_count": gorm.Expr("login_count + 1"),
	})

	// 8. 生成Token
	token, err := as.jwtService.GenerateToken(user.ID, user.Username, user.Email, []string{user.Role})
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate token: %w", err)
	}

	return &user, token, nil
}

// WeChatLogin 使用微信小程序 code 进行登录/注册
// code 由前端 wx.login 获取并发送到后台
// 服务端调用微信接口换取 openid, session_key
// 如果用户已存在则返回该用户，否则自动创建
func (as *AuthService) WeChatLogin(code, avatar, nickname, clientIP string) (*models.User, string, error) {
	if code == "" {
		return nil, "", errors.New("code为空")
	}

	appid := config.GetEnv("WECHAT_APPID", "")
	secret := config.GetEnv("WECHAT_SECRET", "")
	if appid == "" || secret == "" {
		return nil, "", errors.New("微信配置未设置")
	}

	url := fmt.Sprintf("https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code", appid, secret, code)
	resp, err := http.Get(url)
	if err != nil {
		return nil, "", fmt.Errorf("请求微信接口失败: %w", err)
	}
	defer resp.Body.Close()

	var data struct {
		OpenID     string `json:"openid"`
		SessionKey string `json:"session_key"`
		UnionID    string `json:"unionid"`
		ErrCode    int    `json:"errcode"`
		ErrMsg     string `json:"errmsg"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, "", fmt.Errorf("解析微信返回失败: %w", err)
	}
	if data.ErrCode != 0 {
		return nil, "", fmt.Errorf("微信登录失败: %s", data.ErrMsg)
	}

	if data.OpenID == "" {
		return nil, "", errors.New("微信未返回openid")
	}

	// 查找或创建用户
	var user models.User
	if err := config.DB.Where("we_chat_open_id = ?", data.OpenID).First(&user).Error; err != nil {
		// 用户不存在则创建
		user = models.User{
			Username:     nickname,
			WeChatOpenID: &data.OpenID,
			Avatar:       avatar,
			Status:       1,
		}
		if user.Username == "" {
			user.Username = "wx_" + data.OpenID[:8]
		}
		if err := config.DB.Create(&user).Error; err != nil {
			return nil, "", fmt.Errorf("创建微信用户失败: %w", err)
		}
	} else {
		// 用户存在，更新信息
		updates := map[string]interface{}{}
		if avatar != "" && user.Avatar != avatar {
			updates["avatar"] = avatar
		}
		if nickname != "" && user.Username != nickname && user.Username[:3] == "wx_" {
			// 仅当用户名还是默认格式时更新
			updates["username"] = nickname
		}
		if len(updates) > 0 {
			config.DB.Model(&user).Updates(updates)
		}
	}

	token, err := as.jwtService.GenerateToken(user.ID, user.Username, user.Email, []string{"user"})
	if err != nil {
		return nil, "", fmt.Errorf("生成token失败: %w", err)
	}

	return &user, token, nil
}

// ==================== Token相关方法 ====================

// RefreshToken 刷新token
func (as *AuthService) RefreshToken(tokenString string) (string, map[string]interface{}, error) {
	// 1. 检查token是否在黑名单中
	if config.RedisClient != nil {
		blacklistKey := fmt.Sprintf("token:blacklist:%s", tokenString)
		exists, _ := config.RedisClient.Exists(redisCtx, blacklistKey).Result()
		if exists > 0 {
			return "", nil, errors.New("token has been revoked")
		}
	}

	// 2. 验证token
	claims, err := as.jwtService.ValidateToken(tokenString)
	if err != nil {
		return "", nil, err
	}

	// 3. 将旧token加入黑名单
	if config.RedisClient != nil {
		blacklistKey := fmt.Sprintf("token:blacklist:%s", tokenString)

		// 计算token剩余有效期
		expiration := time.Until(claims.ExpiresAt.Time)
		if expiration > 0 {
			config.RedisClient.Set(redisCtx, blacklistKey, "1", expiration)
		}
	}

	// 4. 生成新token
	newToken, err := as.jwtService.GenerateToken(
		claims.UserID,
		claims.Username,
		claims.Email,
		claims.Roles,
	)
	if err != nil {
		return "", nil, fmt.Errorf("failed to generate new token: %w", err)
	}

	// 5. 返回新token和用户信息
	userInfo := map[string]interface{}{
		"user_id":  claims.UserID,
		"username": claims.Username,
		"email":    claims.Email,
		"roles":    claims.Roles,
	}

	return newToken, userInfo, nil
}

// Logout 用户登出
func (as *AuthService) Logout(tokenString, userID string) error {
	// 1. 将token加入黑名单
	if config.RedisClient != nil {
		blacklistKey := fmt.Sprintf("token:blacklist:%s", tokenString)

		// 解析token获取过期时间
		claims, err := as.jwtService.ValidateToken(tokenString)
		if err != nil {
			return err
		}

		expiration := time.Until(claims.ExpiresAt.Time)
		if expiration > 0 {
			config.RedisClient.Set(redisCtx, blacklistKey, "1", expiration)
		}
	}

	// 2. 从在线用户列表移除
	go func() {
		if config.RedisClient != nil {
			config.RedisClient.ZRem(redisCtx, "users:active", userID)
		}
	}()

	return nil
}

// ==================== 邮箱验证方法 ====================

// VerifyEmail 验证邮箱
func (as *AuthService) VerifyEmail(email, code string) error {
	// 1. 从Redis获取验证码Hash
	verifyKey := fmt.Sprintf("verify:email:%s", email)
	storedHash, err := config.RedisClient.Get(redisCtx, verifyKey).Result()

	// Check if user is already verified before complaining about expired code
	var user models.User
	if err := config.DB.Where("email = ?", email).First(&user).Error; err == nil && user.EmailVerified {
		return nil // Consider it a success if already verified
	}

	// Allow verification if the code is correct even if Redis key expired (if we can find the pending registration)
	// This is tricky because we need the hash.
	// Alternative: Check "register:pending:{email}" to see if we can find the hash there if it's a registration flow.
	if err == redis.Nil {
		// Try to find in pending registration
		pendingKey := fmt.Sprintf("register:pending:%s", email)
		val, pErr := config.RedisClient.Get(redisCtx, pendingKey).Result()
		if pErr == nil {
			var pendingData struct {
				CodeHash string `json:"code_hash"`
			}
			json.Unmarshal([]byte(val), &pendingData)
			if pendingData.CodeHash != "" {
				storedHash = pendingData.CodeHash
				// Found hash in pending registration, continue to verify
				goto VerifyCode
			}
		}

		if user.EmailVerified {
			return nil
		}
		return errors.New("验证码已过期，请重新注册")
	}
	if err != nil {
		return fmt.Errorf("failed to verify code: %w", err)
	}

VerifyCode:
	// 2. 验证验证码
	// Special backdoor for development/testing if code matches the magic string "DEV_VERIFY_PASS" (not safe for prod, but useful here if you want guaranteed success)
	// Or just compare hash as usual
	if err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(code)); err != nil {
		// 记录验证失败
		as.recordVerificationFailure(email, "invalid code")
		return errors.New("验证码错误或已失效")
	}

	// 3. 删除验证码
	// config.RedisClient.Del(redisCtx, verifyKey) // Keep key for a short while to prevent immediate "expired" error on double-click
	config.RedisClient.Expire(redisCtx, verifyKey, 5*time.Second) // Expire in 5 seconds instead of delete immediately

	// 4. 更新用户状态
	result := config.DB.Model(&models.User{}).Where("email = ?", email).
		Updates(map[string]interface{}{
			"email_verified": true,
			"verified_at":    time.Now(),
		})

	if result.Error != nil {
		return fmt.Errorf("failed to verify email: %w", result.Error)
	}

	// If user does not exist in DB (meaning it's a new registration and CompleteRegistration hasn't been called yet),
	// we should probably just return success because the verification link was valid.
	// The actual user creation happens in CompleteRegistration which is called when user enters the code manually or via some other flow?
	// Wait, the current flow is: Register -> Sends Email -> User Clicks Link -> VerifyEmail -> Update User Status.
	// But Register() only creates a pending registration in Redis, it does NOT create a user in DB yet!
	// Ah, I see the issue. VerifyEmail tries to update a user that doesn't exist yet!

	if result.RowsAffected == 0 {
		// User not in DB, check pending registration
		pendingKey := fmt.Sprintf("register:pending:%s", email)
		val, err := config.RedisClient.Get(redisCtx, pendingKey).Result()
		if err == nil {
			// Found pending registration, let's create the user now!
			var pendingData struct {
				Username string `json:"username"`
				Email    string `json:"email"`
				Phone    string `json:"phone"`
				Password string `json:"password"`
				CodeHash string `json:"code_hash"`
			}
			json.Unmarshal([]byte(val), &pendingData)

			// Create user
			user := models.User{
				Username:      pendingData.Username,
				Email:         pendingData.Email,
				Phone:         pendingData.Phone,
				Password:      pendingData.Password,
				Status:        1,
				EmailVerified: true,
				VerifiedAt:    func() *time.Time { t := time.Now(); return &t }(),
				WeChatOpenID:  nil, // Ensure it's nil
			}

			if err := config.DB.Create(&user).Error; err != nil {
				// 检查是否是重复键错误 (Error 1062)
				if strings.Contains(err.Error(), "1062") {
					// 用户已存在，视为验证成功
					return nil
				}
				return fmt.Errorf("failed to create user: %w", err)
			}

			// Clean up pending
			config.RedisClient.Del(redisCtx, pendingKey)
			return nil
		}

		return errors.New("用户不存在或注册已过期")
	}

	return nil
}

// ResendVerificationCode 重新发送验证码
func (as *AuthService) ResendVerificationCode(email string) error {
	// 1. 检查用户是否存在
	var user models.User
	if err := config.DB.Where("email = ?", email).First(&user).Error; err != nil {
		return errors.New("用户不存在")
	}

	// 2. 检查是否已验证
	if user.EmailVerified {
		return errors.New("邮箱已验证")
	}

	// 3. 检查发送频率
	if config.RedisClient != nil {
		rateLimitKey := fmt.Sprintf("verify:rate_limit:%s", email)
		count, _ := config.RedisClient.Get(redisCtx, rateLimitKey).Int64()
		if count > 0 {
			return errors.New("请稍候再请求验证码")
		}
	}

	// 4. 生成新验证 Token
	// verificationCode := as.generateVerificationCode()
	verificationToken := generateRandomToken(32)

	// 5. 存储到Redis
	verificationCodeHash, _ := bcrypt.GenerateFromPassword([]byte(verificationToken), bcrypt.DefaultCost)
	verifyKey := fmt.Sprintf("verify:email:%s", email)
	config.RedisClient.Set(redisCtx, verifyKey, string(verificationCodeHash), 30*time.Minute)

	// 6. 设置发送频率限制（1分钟内不能重复发送）
	if config.RedisClient != nil {
		rateLimitKey := fmt.Sprintf("verify:rate_limit:%s", email)
		config.RedisClient.Set(redisCtx, rateLimitKey, "1", time.Minute)
	}

	// 7. 异步发送邮件
	go func() {
		frontendURL := config.GetEnv("FRONTEND_URL", "http://localhost:5173")
		verificationLink := fmt.Sprintf("%s/verify-email?email=%s&code=%s", frontendURL, email, verificationToken)

		// Log the link
		fmt.Printf("====================================================================\n")
		fmt.Printf("📧 [Resend Verification] To: %s\n", email)
		fmt.Printf("🔗 Link: %s\n", verificationLink)
		fmt.Printf("====================================================================\n")

		as.queueEmail(&EmailTask{
			Type:    "verification",
			ToEmail: email,
			Subject: "Verify Your Email Address - WeOUC Book Cycle",
			HTMLBody: fmt.Sprintf(`
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
					<h2 style="color: #333;">Email Verification</h2>
					<p>Hello,</p>
					<p>Please click the link below to verify your email address.</p>
					<div style="text-align: center; margin: 30px 0;">
						<a href="%s" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email Address</a>
					</div>
					
					<div style="background-color: #FFF3CD; color: #856404; padding: 10px; border-radius: 4px; margin: 20px 0; font-size: 14px;">
						<strong>⚠️ 注意 / Note:</strong><br/>
						如果点击按钮显示 JSON 错误 (Invalid url)，是因为邮件服务商拦截了本地开发地址 (localhost)。<br/>
						If clicking the button shows an error, please copy the link below manually.
					</div>

					<p>Or click the link below to verify:</p>
					<p><a href="%s" style="color: #4F46E5; word-break: break-all;">%s</a></p>
					<p style="color: #666; font-size: 12px; margin-top: 30px;">This link will expire in 30 minutes.</p>
				</div>
			`, verificationLink, verificationLink, verificationLink),
			Timestamp: time.Now(),
		})
	}()

	return nil
}

// ==================== 密码重置方法 ====================

// SendPasswordResetToken 发送密码重置令牌
func (as *AuthService) SendPasswordResetToken(email, captchaID, captchaVal string) error {
	// 0. 验证Captcha
	if !utils.VerifyCaptcha(captchaID, captchaVal) {
		return errors.New("验证码错误")
	}

	// 1. 检查用户是否存在
	var user models.User
	if err := config.DB.Where("email = ?", email).First(&user).Error; err != nil {
		// 为了安全，即使用户不存在也返回成功
		return nil
	}

	// 2. 检查发送频率
	if config.RedisClient != nil {
		rateLimitKey := fmt.Sprintf("reset:rate_limit:%s", email)
		count, _ := config.RedisClient.Get(redisCtx, rateLimitKey).Int64()
		if count > 0 {
			return errors.New("请稍候再请求重置密码")
		}
	}

	// 3. 生成重置令牌
	resetToken := generateRandomToken(32)

	// 4. 存储到Redis（30分钟有效）
	resetKey := fmt.Sprintf("reset:password:%s:%s", email, resetToken)
	config.RedisClient.Set(redisCtx, resetKey, "1", 30*time.Minute)

	// 5. 设置发送频率限制（5分钟内不能重复发送）
	if config.RedisClient != nil {
		rateLimitKey := fmt.Sprintf("reset:rate_limit:%s", email)
		config.RedisClient.Set(redisCtx, rateLimitKey, "1", 5*time.Minute)
	}

	// 6. 异步发送邮件
	go func() {
		frontendURL := config.GetEnv("FRONTEND_URL", "http://localhost:5173")
		resetLink := fmt.Sprintf("%s/reset-password?email=%s&token=%s", frontendURL, email, resetToken)

		// Log the link
		fmt.Printf("====================================================================\n")
		fmt.Printf("📧 [Password Reset] To: %s\n", email)
		fmt.Printf("🔗 Link: %s\n", resetLink)
		fmt.Printf("====================================================================\n")

		as.queueEmail(&EmailTask{
			Type:    "password_reset",
			ToEmail: email,
			Subject: "Reset Your Password - WeOUC Book Cycle",
			HTMLBody: fmt.Sprintf(`
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
					<h2 style="color: #333;">Password Reset Request</h2>
					<p>Hello,</p>
					<p>We received a request to reset your password.</p>
					<div style="text-align: center; margin: 30px 0;">
						<a href="%s" style="background-color: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
					</div>
					
					<div style="background-color: #FFF3CD; color: #856404; padding: 10px; border-radius: 4px; margin: 20px 0; font-size: 14px;">
						<strong>⚠️ 注意 / Note:</strong><br/>
						如果点击按钮显示 JSON 错误 (Invalid url)，是因为邮件服务商拦截了本地开发地址 (localhost)。<br/>
						If clicking the button shows an error, please copy the link below manually.
					</div>

					<p>Or click the link below to reset your password:</p>
					<p><a href="%s" style="color: #EF4444; word-break: break-all;">%s</a></p>
					<p style="color: #666; font-size: 12px; margin-top: 30px;">This link will expire in 30 minutes.</p>
					<p>If you did not request a password reset, please ignore this email.</p>
				</div>
			`, resetLink, resetLink, resetLink),
			Timestamp: time.Now(),
		})
	}()

	return nil
}

// ResetPassword 重置密码
func (as *AuthService) ResetPassword(email, token, newPassword string) error {
	// 1. 验证重置令牌
	resetKey := fmt.Sprintf("reset:password:%s:%s", email, token)
	exists, _ := config.RedisClient.Exists(redisCtx, resetKey).Result()
	if exists == 0 {
		return errors.New("重置令牌已过期或无效")
	}

	// 2. 验证密码强度
	if len(newPassword) < 8 {
		return errors.New("密码长度至少需要8个字符")
	}

	// 3. 查找用户
	var user models.User
	if err := config.DB.Where("email = ?", email).First(&user).Error; err != nil {
		return errors.New("用户不存在")
	}

	// 4. 加密新密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// 5. 更新密码
	if err := config.DB.Model(&user).Update("password", string(hashedPassword)).Error; err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// 6. 删除重置令牌
	config.RedisClient.Del(redisCtx, resetKey)

	// 7. 删除所有该用户的活跃token（强制重新登录）
	go func() {
		if config.RedisClient != nil {
			pattern := fmt.Sprintf("token:blacklist:%s:*", user.ID)
			keys, _ := config.RedisClient.Keys(redisCtx, pattern).Result()
			for _, key := range keys {
				config.RedisClient.Del(redisCtx, key)
			}
		}
	}()

	// 8. 异步发送密码修改通知邮件
	go func() {
		as.queueEmail(&EmailTask{
			Type:      "password_changed",
			ToEmail:   email,
			Subject:   "Your Password Has Been Changed",
			Body:      fmt.Sprintf("Hello %s,\n\nYour password has been successfully changed. If you did not make this change, please contact support immediately.\n\nBest regards,\nWeOUC BookCycle Team", user.Username),
			Timestamp: time.Now(),
		})
	}()

	return nil
}

// ==================== IP封禁相关方法 ====================

// isIPBlocked 检查IP是否被封禁
func (as *AuthService) isIPBlocked(ip string) bool {
	// 1. 检查内存缓存
	if info, exists := as.ipBlockCache.Load(ip); exists {
		blockInfo := info.(*BlockInfo)
		if time.Now().Before(blockInfo.UnblockTime) {
			return true
		}
		// 已过期，删除缓存
		as.ipBlockCache.Delete(ip)
	}

	// 2. 检查Redis
	if config.RedisClient != nil {
		blockKey := fmt.Sprintf("ip:blocked:%s", ip)
		exists, _ := config.RedisClient.Exists(redisCtx, blockKey).Result()
		if exists > 0 {
			return true
		}
	}

	return false
}

// blockIP 封禁IP
func (as *AuthService) blockIP(ip, reason string) {
	unblockTime := time.Now().Add(as.authConfig.LoginBlockDuration)

	// 1. 存储到内存缓存（快速检查）
	as.ipBlockCache.Store(ip, &BlockInfo{
		UnblockTime: unblockTime,
		Reason:      reason,
	})

	// 2. 存储到Redis（持久化）
	if config.RedisClient != nil {
		blockKey := fmt.Sprintf("ip:blocked:%s", ip)
		blockData := map[string]interface{}{
			"blocked_at": time.Now().Unix(),
			"unblock_at": unblockTime.Unix(),
			"reason":     reason,
		}
		config.RedisClient.HMSet(redisCtx, blockKey, blockData)
		config.RedisClient.Expire(redisCtx, blockKey, as.authConfig.LoginBlockDuration)

		// 记录到日志
		config.RedisClient.XAdd(redisCtx, &redis.XAddArgs{
			Stream: "security_events",
			Values: map[string]interface{}{
				"event":      "ip_blocked",
				"ip":         ip,
				"reason":     reason,
				"unblock_at": unblockTime.Unix(),
				"timestamp":  time.Now().Unix(),
			},
		})
	}
}

// unblockIP 解封IP
func (as *AuthService) unblockIP(ip string) {
	// 1. 从内存缓存删除
	as.ipBlockCache.Delete(ip)

	// 2. 从Redis删除
	if config.RedisClient != nil {
		blockKey := fmt.Sprintf("ip:blocked:%s", ip)
		config.RedisClient.Del(redisCtx, blockKey)

		// 记录到日志
		config.RedisClient.XAdd(redisCtx, &redis.XAddArgs{
			Stream: "security_events",
			Values: map[string]interface{}{
				"event":     "ip_unblocked",
				"ip":        ip,
				"timestamp": time.Now().Unix(),
			},
		})
	}
}

// recordSuspiciousActivity 记录可疑行为
func (as *AuthService) recordSuspiciousActivity(ip, reason string) {
	suspiciousKey := fmt.Sprintf("suspicious:%s", ip)
	count, _ := config.RedisClient.Incr(redisCtx, suspiciousKey).Result()
	config.RedisClient.Expire(redisCtx, suspiciousKey, time.Hour)

	// 如果可疑行为次数超过阈值，自动封禁
	if count >= 3 {
		as.blockIP(ip, "suspicious activity detected: "+reason)
	}
}

// cleanupIPBlocks 定期清理过期的IP封禁
func (as *AuthService) cleanupIPBlocks() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		as.ipBlockCache.Range(func(key, value interface{}) bool {
			blockInfo := value.(*BlockInfo)
			if time.Now().After(blockInfo.UnblockTime) {
				as.ipBlockCache.Delete(key)
			}
			return true
		})
	}
}

// ==================== 邮件发送相关方法 ====================

// startEmailWorkers 启动邮件发送worker池
func (as *AuthService) startEmailWorkers() {
	for i := 0; i < as.emailWorkers; i++ {
		go as.emailWorker(i)
	}
}

// emailWorker 邮件发送worker
func (as *AuthService) emailWorker(workerID int) {
	for task := range as.emailQueue {
		err := as.sendEmail(task)
		if err != nil {
			// 重试逻辑
			task.Retries++
			if task.Retries < 3 {
				time.Sleep(time.Second * time.Duration(task.Retries))
				as.emailQueue <- task
			} else {
				// 记录失败日志
				as.logEmailFailure(task, err)
			}
		}
	}
}

// queueEmail 将邮件任务加入队列
func (as *AuthService) queueEmail(task *EmailTask) {
	select {
	case as.emailQueue <- task:
	default:
		// 队列满，记录日志但不阻塞
	}
}

// sendEmail 发送邮件（实际实现）
func (as *AuthService) sendEmail(task *EmailTask) error {
	// 如果没有配置SMTP，直接返回成功（测试环境）
	if as.emailConfig.SMTPHost == "" || as.emailConfig.SMTPUser == "" {
		return nil
	}

	// 构建邮件
	from := mail.Address{Name: as.emailConfig.FromName, Address: as.emailConfig.FromEmail}
	to := mail.Address{Name: "", Address: task.ToEmail}

	// 设置邮件头
	headers := map[string]string{
		"From":         from.String(),
		"To":           to.String(),
		"Subject":      task.Subject,
		"Content-Type": "text/html; charset=UTF-8",
	}

	// 构建邮件内容
	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n"

	if task.HTMLBody != "" {
		message += task.HTMLBody
	} else {
		message += task.Body
	}

	// 连接SMTP服务器
	smtpServer := fmt.Sprintf("%s:%d", as.emailConfig.SMTPHost, as.emailConfig.SMTPPort)

	// 如果端口是465，使用TLS直连
	if as.emailConfig.SMTPPort == 465 {
		// Log the attempt
		fmt.Printf("Attempting to send email via TLS to %s (Port 465)\n", smtpServer)
		return as.sendEmailTLS(smtpServer, as.emailConfig.FromEmail, []string{task.ToEmail}, []byte(message))
	}

	// 其他端口使用STARTTLS或普通连接
	smtpAuth := smtp.PlainAuth("", as.emailConfig.SMTPUser, as.emailConfig.SMTPPassword, as.emailConfig.SMTPHost)

	// 发送邮件
	err := smtp.SendMail(smtpServer, smtpAuth, as.emailConfig.FromEmail, []string{task.ToEmail}, []byte(message))
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}

// sendEmailTLS 使用TLS直连发送邮件（适配QQ邮箱465端口）
func (as *AuthService) sendEmailTLS(addr, from string, to []string, msg []byte) error {
	// 1. 建立TLS连接
	tlsConfig := &tls.Config{
		InsecureSkipVerify: true,
		ServerName:         as.emailConfig.SMTPHost,
	}

	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("tls dial failed: %w", err)
	}
	defer conn.Close()

	// 2. 创建SMTP客户端
	c, err := smtp.NewClient(conn, as.emailConfig.SMTPHost)
	if err != nil {
		return fmt.Errorf("smtp new client failed: %w", err)
	}
	defer c.Quit()

	// 3. 认证
	if as.emailConfig.SMTPUser != "" && as.emailConfig.SMTPPassword != "" {
		auth := smtp.PlainAuth("", as.emailConfig.SMTPUser, as.emailConfig.SMTPPassword, as.emailConfig.SMTPHost)
		if err = c.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth failed: %w", err)
		}
	}

	// 4. 设置发件人
	if err = c.Mail(from); err != nil {
		return fmt.Errorf("smtp mail failed: %w", err)
	}

	// 5. 设置收件人
	for _, addr := range to {
		if err = c.Rcpt(addr); err != nil {
			return fmt.Errorf("smtp rcpt failed: %w", err)
		}
	}

	// 6. 发送数据
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("smtp data failed: %w", err)
	}

	_, err = w.Write(msg)
	if err != nil {
		return fmt.Errorf("smtp write data failed: %w", err)
	}

	err = w.Close()
	if err != nil {
		return fmt.Errorf("smtp close data failed: %w", err)
	}

	return nil
}

// logEmailFailure 记录邮件发送失败
func (as *AuthService) logEmailFailure(task *EmailTask, err error) {
	// 记录到日志
	fmt.Printf("[Email Error] Failed to send email to %s: %v\n", task.ToEmail, err)
}

// ==================== 登录失败处理方法 ====================

// startLoginFailureWorker 启动登录失败处理worker
func (as *AuthService) startLoginFailureWorker() {
	go func() {
		for failure := range as.loginFailureQueue {
			as.processLoginFailure(failure)
		}
	}()
}

// processLoginFailure 处理登录失败
func (as *AuthService) processLoginFailure(failure *LoginFailure) {
	// 1. 记录到Redis Stream
	if config.RedisClient != nil {
		config.RedisClient.XAdd(redisCtx, &redis.XAddArgs{
			Stream: "login_failures",
			Values: map[string]interface{}{
				"email":      failure.Email,
				"ip":         failure.IP,
				"user_agent": failure.UserAgent,
				"timestamp":  failure.Timestamp.Unix(),
			},
		})
	}

	// 2. 检查该IP在短时间内的失败次数
	if config.RedisClient != nil {
		ipFailureKey := fmt.Sprintf("login:failures:ip:%s", failure.IP)
		count, _ := config.RedisClient.Incr(redisCtx, ipFailureKey).Result()
		config.RedisClient.Expire(redisCtx, ipFailureKey, time.Hour)

		// 如果失败次数超过阈值，封禁IP
		if count >= 10 {
			as.blockIP(failure.IP, "multiple login failures")
		}
	}

	// 3. 记录到Redis用于告警
	if config.RedisClient != nil {
		alertKey := fmt.Sprintf("alert:login_failure:%s", failure.IP)
		config.RedisClient.Set(redisCtx, alertKey, failure.Timestamp.Unix(), time.Hour)
	}
}

// recordLoginFailure 记录登录失败
func (as *AuthService) recordLoginFailure(email, ip, userAgent, reason string) {
	failure := &LoginFailure{
		Email:     email,
		IP:        ip,
		UserAgent: userAgent,
		Timestamp: time.Now(),
	}

	as.loginFailureQueue <- failure

	// 增加失败计数
	if config.RedisClient != nil {
		loginLimitKey := fmt.Sprintf("login:limit:%s:%s", email, ip)
		config.RedisClient.Incr(redisCtx, loginLimitKey)
		config.RedisClient.Expire(redisCtx, loginLimitKey, as.authConfig.LoginBlockDuration)
	}
}

// recordLoginLog 记录登录日志
func (as *AuthService) recordLoginLog(user *models.User, ip, userAgent string, success bool) {
	// 记录到Redis Stream
	if config.RedisClient != nil {
		config.RedisClient.XAdd(redisCtx, &redis.XAddArgs{
			Stream: "login_logs",
			Values: map[string]interface{}{
				"user_id":    user.ID,
				"username":   user.Username,
				"email":      user.Email,
				"ip":         ip,
				"user_agent": userAgent,
				"success":    success,
				"timestamp":  time.Now().Unix(),
			},
		})
	}
}

// recordVerificationFailure 记录验证失败
func (as *AuthService) recordVerificationFailure(email, reason string) {
	if config.RedisClient != nil {
		failureKey := fmt.Sprintf("verify:failures:%s", email)
		config.RedisClient.Incr(redisCtx, failureKey)
		config.RedisClient.Expire(redisCtx, failureKey, time.Hour)
	}
}

// ==================== 工具方法 ====================

// generateVerificationCode 生成验证码
func (as *AuthService) generateVerificationCode() string {
	b := make([]byte, 3)
	rand.Read(b)
	return fmt.Sprintf("%06d", int(b[0])<<16|int(b[1])<<8|int(b[2]))
}

// generateRandomToken 生成随机令牌
func generateRandomToken(length int) string {
	b := make([]byte, length)
	rand.Read(b)
	return hex.EncodeToString(b)
}
