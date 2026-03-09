package controllers

import (
	"net/http"
	"os"
	"weoucbookcycle_go/services"
	"weoucbookcycle_go/utils"

	"github.com/gin-gonic/gin"
)

// AuthController 认证控制器
type AuthController struct {
	authService *services.AuthService
}

// NewAuthController 创建认证控制器实例
func NewAuthController() *AuthController {
	return &AuthController{
		authService: services.NewAuthService(),
	}
}

// GetCaptcha 获取验证码
func (ac *AuthController) GetCaptcha(c *gin.Context) {
	id, b64s, err := utils.GenerateCaptcha()
	if err != nil {
		utils.Error(c, utils.CodeInternalServerError, "Failed to generate captcha")
		return
	}
	utils.SuccessWithMessage(c, "success", gin.H{
		"captcha_id":    id,
		"captcha_image": b64s,
	})
}

// CompleteRegistrationRequest 完成注册请求
type CompleteRegistrationRequest struct {
	Identifier string `json:"identifier" binding:"required"`
	Code       string `json:"code" binding:"required"`
}

// CompleteRegistration 完成注册
func (ac *AuthController) CompleteRegistration(c *gin.Context) {
	var req CompleteRegistrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	user, token, err := ac.authService.CompleteRegistration(req.Identifier, req.Code, c.ClientIP())
	if err != nil {
		utils.Error(c, utils.CodeError, err.Error())
		return
	}

	utils.SuccessWithMessage(c, "注册成功", gin.H{
		"token":     token,
		"expiresIn": 7200,
		"user": gin.H{
			"id":             user.ID,
			"username":       user.Username,
			"email":          user.Email,
			"phone":          user.Phone,
			"email_verified": user.EmailVerified,
		},
	})
}

// RegisterRequest 注册请求结构
type RegisterRequest struct {
	Username   string `json:"username" binding:"required,min=3,max=50"`
	Email      string `json:"email"`
	Phone      string `json:"phone"`
	Password   string `json:"password" binding:"required,min=8"`
	CaptchaID  string `json:"captcha_id" binding:"required"`
	CaptchaVal string `json:"captcha_val" binding:"required"`
}

// LoginRequest 登录请求结构
type LoginRequest struct {
	Identifier string `json:"identifier" binding:"required"`
	Password   string `json:"password" binding:"required"`
}

// WeChatLoginRequest 微信登录请求结构
// 小程序端需提供通过 wx.login 获得的 code
// 后端使用 code 向微信官方接口换取 openid 并执行登录
// 如果用户不存在则自动创建
// 注意：由于小程序本身无跨域限制，前端可直接调用此接口
// @Summary 微信小程序登录
// @Tags auth
// @Accept json
// @Produce json
// @Param request body WeChatLoginRequest true "微信登录信息"
// @Success 200 {object} map[string]interface{}
// @Router /api/auth/wechat [post]
type WeChatLoginRequest struct {
	Code     string `json:"code" binding:"required"`
	Avatar   string `json:"avatar"`
	Nickname string `json:"nickname"`
}

// VerifyEmailRequest 验证邮箱请求结构
type VerifyEmailRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required"`
}

// ResendVerificationRequest 重新发送验证码请求结构
type ResendVerificationRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// SendPasswordResetRequest 发送密码重置请求结构
type SendPasswordResetRequest struct {
	Email      string `json:"email" binding:"required,email"`
	CaptchaID  string `json:"captcha_id" binding:"required"`
	CaptchaVal string `json:"captcha_val" binding:"required"`
}

// ResetPasswordRequest 重置密码请求结构
type ResetPasswordRequest struct {
	Email       string `json:"email" binding:"required,email"`
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

// Register 用户注册
// @Summary 用户注册
// @Description 创建新用户账号
// @Tags auth
// @Accept json
// @Produce json
// @Param request body RegisterRequest true "注册信息"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/auth/register [post]
func (ac *AuthController) Register(c *gin.Context) {
	var req services.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	if err := ac.authService.Register(&req, c.ClientIP()); err != nil {
		utils.Error(c, utils.CodeError, err.Error())
		return
	}

	utils.SuccessWithMessage(c, "验证码已发送", nil)
}

// Login 用户登录
// @Summary 用户登录
// @Description 用户登录获取JWT token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body LoginRequest true "登录信息"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/auth/login [post]
func (ac *AuthController) Login(c *gin.Context) {
	var req services.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	user, token, err := ac.authService.Login(&req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		utils.Error(c, utils.CodeUnauthorized, err.Error())
		return
	}

	utils.SuccessWithMessage(c, "登录成功", gin.H{
		"token":     token,
		"expiresIn": 7200,
		"user": gin.H{
			"id":             user.ID,
			"username":       user.Username,
			"email":          user.Email,
			"phone":          user.Phone,
			"avatar":         user.Avatar,
			"email_verified": user.EmailVerified,
		},
	})

	// Set HttpOnly Cookie
	c.SetCookie("jwt_token", token, 7200, "/", "", false, true)
}

// RefreshToken 刷新token
// @Summary 刷新token
// @Description 刷新过期的JWT token
// @Tags auth
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/auth/refresh [post]
func (ac *AuthController) RefreshToken(c *gin.Context) {
	tokenString := c.GetHeader("Authorization")
	if tokenString == "" {
		// Try to get from cookie
		if cookie, err := c.Cookie("jwt_token"); err == nil {
			tokenString = cookie
		}
	}

	if tokenString == "" {
		utils.Error(c, utils.CodeUnauthorized, "Authorization header or cookie required")
		return
	}

	// 移除 "Bearer " 前缀
	if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
		tokenString = tokenString[7:]
	}

	newToken, userInfo, err := ac.authService.RefreshToken(tokenString)
	if err != nil {
		utils.Error(c, utils.CodeUnauthorized, "Failed to refresh token")
		return
	}

	utils.SuccessWithMessage(c, "Token刷新成功", gin.H{
		"token":     newToken,
		"expiresIn": 7200,
		"user":      userInfo,
	})
}

// Logout 用户登出
// @Summary 用户登出
// @Description 用户登出，将token加入黑名单
// @Tags auth
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/auth/logout [post]
func (ac *AuthController) Logout(c *gin.Context) {
	tokenString := c.GetHeader("Authorization")
	if tokenString == "" {
		// Try to get from cookie
		if cookie, err := c.Cookie("jwt_token"); err == nil {
			tokenString = cookie
		}
	}

	if tokenString == "" {
		utils.Error(c, utils.CodeUnauthorized, "Authorization header or cookie required")
		return
	}

	// 移除 "Bearer " 前缀
	if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
		tokenString = tokenString[7:]
	}

	userID := c.GetString("user_id")

	if err := ac.authService.Logout(tokenString, userID); err != nil {
		utils.Error(c, utils.CodeInternalServerError, err.Error())
		return
	}

	utils.SuccessWithMessage(c, "Logout successful", nil)

	// Clear HttpOnly Cookie
	c.SetCookie("jwt_token", "", -1, "/", "", false, true)
}

// WeChatLoginRequest 微信登录请求
// 注意：小程序端应先调用 wx.login 获取 code，然后将 code 发送到此接口
// 服务端使用 appid/secret 向微信接口换取 openid 并查找/创建用户
// @Description 使用微信小程序 code 登录，返回 JWT token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body WeChatLoginRequest true "微信登录信息"
// @Success 200 {object} map[string]interface{}
// @Router /api/auth/wechat [post]
func (ac *AuthController) WeChatLogin(c *gin.Context) {
	var req WeChatLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	user, token, err := ac.authService.WeChatLogin(req.Code, req.Avatar, req.Nickname, c.ClientIP())
	if err != nil {
		utils.Error(c, utils.CodeUnauthorized, err.Error())
		return
	}

	utils.SuccessWithMessage(c, "登录成功", gin.H{
		"token":     token,
		"expiresIn": 7200,
		"user": gin.H{
			"id":             user.ID,
			"username":       user.Username,
			"avatar":         user.Avatar,
			"email_verified": user.EmailVerified,
		},
	})

	// Set HttpOnly Cookie with SameSite: Strict
	c.SetSameSite(http.SameSiteStrictMode)
	isSecure := os.Getenv("GIN_MODE") == "release"
	c.SetCookie("jwt_token", token, 7200, "/", "", isSecure, true)
}

// VerifyEmail 验证邮箱
// @Summary 验证邮箱
// @Description 验证用户邮箱
// @Tags auth
// @Accept json
// @Produce json
// @Param request body VerifyEmailRequest true "验证信息"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/auth/verify-email [post]
func (ac *AuthController) VerifyEmail(c *gin.Context) {
	var req VerifyEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	if err := ac.authService.VerifyEmail(req.Email, req.Code); err != nil {
		utils.Error(c, utils.CodeError, err.Error())
		return
	}

	utils.SuccessWithMessage(c, "Email verified successfully", nil)
}

// ResendVerificationCode 重新发送验证码
// @Summary 重新发送验证码
// @Description 重新发送邮箱验证码
// @Tags auth
// @Accept json
// @Produce json
// @Param request body ResendVerificationRequest true "邮箱地址"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/auth/resend-verification [post]
func (ac *AuthController) ResendVerificationCode(c *gin.Context) {
	var req ResendVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	if err := ac.authService.ResendVerificationCode(req.Email); err != nil {
		utils.Error(c, utils.CodeError, err.Error())
		return
	}

	utils.SuccessWithMessage(c, "Verification code sent successfully", nil)
}

// SendPasswordResetToken 发送密码重置令牌
// @Summary 发送密码重置令牌
// @Description 发送密码重置邮件
// @Tags auth
// @Accept json
// @Produce json
// @Param request body SendPasswordResetRequest true "邮箱地址"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/auth/send-password-reset [post]
func (ac *AuthController) SendPasswordResetToken(c *gin.Context) {
	var req SendPasswordResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	if err := ac.authService.SendPasswordResetToken(req.Email, req.CaptchaID, req.CaptchaVal); err != nil {
		utils.Error(c, utils.CodeError, err.Error()) // Use CodeError to show message to user
		return
	}

	utils.SuccessWithMessage(c, "Password reset email sent", nil)
}

// ResetPassword 重置密码
// @Summary 重置密码
// @Description 重置用户密码
// @Tags auth
// @Accept json
// @Produce json
// @Param request body ResetPasswordRequest true "重置信息"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/auth/reset-password [post]
func (ac *AuthController) ResetPassword(c *gin.Context) {
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, utils.CodeValidationError, err.Error())
		return
	}

	if err := ac.authService.ResetPassword(req.Email, req.Token, req.NewPassword); err != nil {
		utils.Error(c, utils.CodeError, err.Error())
		return
	}

	utils.SuccessWithMessage(c, "Password reset successfully", nil)
}
