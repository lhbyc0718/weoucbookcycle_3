package main

import (
	"fmt"
	"log"
	"os"

	"time"

	"weoucbookcycle_go/utils"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
	gormmysql "gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// 简单地将 go-admin 启动为独立服务，使用环境变量连接项目的 MySQL 数据库。
// 运行前请确保设置环境变量：DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

func main() {
	// 加载 .env 文件
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  No .env file found, using system environment variables")
	} else {
		log.Println("✅ .env file loaded successfully")
	}
	// 从环境读取数据库连接信息
	host := getenvOrDefault("DB_HOST", "127.0.0.1")
	port := getenvOrDefault("DB_PORT", "3306")
	user := getenvOrDefault("DB_USER", "root")
	password := getenvOrDefault("DB_PASSWORD", "")
	dbname := getenvOrDefault("DB_NAME", "weoucbookcycle")

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local", user, password, host, port, dbname)

	// Minimal Gin server (bypass go-admin). We keep GORM usage to create default admin user.
	r := gin.Default()
	r.GET("/admin", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "admin service running"})
	})
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// 使用 GORM 连接同一数据库，用于创建默认 admin 用户等管理操作
	gormDsn := dsn
	gdb, err := gorm.Open(gormmysql.Open(gormDsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect database via gorm: %v", err)
	}

	// Create default admin if not exists
	adminEmail := getenvOrDefault("ADMIN_EMAIL", "admin@local")
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminPassword == "" {
		// generate random password
		adminPassword = generateRandomPassword(12)
		log.Printf("Generated admin password: %s (set ADMIN_PASSWORD to override)", adminPassword)
	}

	// check existing admin by email
	type userCheck struct {
		ID    string
		Email string
		Role  string
	}
	var uc userCheck
	if err := gdb.Raw("SELECT id, email, role FROM users WHERE email = ?", adminEmail).Scan(&uc).Error; err != nil {
		// ignore
	}
	if uc.Email == "" {
		// create admin user
		hashed, _ := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
		now := time.Now()
		// insert using raw SQL to avoid importing models here
		if err := gdb.Exec("INSERT INTO users (id, username, email, password, role, trust_score, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			utils.GenerateUUID(), "admin", adminEmail, string(hashed), "admin", 100, now, now).Error; err != nil {
			log.Printf("failed to create default admin: %v", err)
		} else {
			log.Printf("Created default admin: %s", adminEmail)
		}
	} else {
		log.Printf("Admin user exists: %s (role=%s)", uc.Email, uc.Role)
	}

	// 启动 HTTP 服务
	addr := getenvOrDefault("ADMIN_ADDR", ":8081")
	log.Printf("Starting minimal admin service at http://localhost%s/admin", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("admin server failed: %v", err)
	}
}

func getenvOrDefault(key, def string) string {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return v
}

func generateRandomPassword(n int) string {
	letters := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		idx := int(time.Now().UnixNano() % int64(len(letters)))
		b[i] = letters[idx]
	}
	return string(b)
}
