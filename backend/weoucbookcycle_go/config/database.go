package config

import (
	"fmt"
	"log"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// DatabaseConfig 数据库配置结构
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	Charset  string
}

// GetDatabaseConfig 从环境变量获取数据库配置
func GetDatabaseConfig() *DatabaseConfig {
	host := GetEnv("DB_HOST", "localhost")
	port := GetEnv("DB_PORT", "3306")
	user := GetEnv("DB_USER", "root")
	password := GetEnv("DB_PASSWORD", "")
	dbName := GetEnv("DB_NAME", "weoucbookcycle")
	charset := GetEnv("DB_CHARSET", "utf8mb4")

	// 调试输出：显示实际读取的值（不输出明文密码）
	log.Printf("📋 Database Config Loaded: Host=%s Port=%s User=%s DBName=%s Charset=%s",
		host, port, user, dbName, charset)

	return &DatabaseConfig{
		Host:     host,
		Port:     port,
		User:     user,
		Password: password,
		DBName:   dbName,
		Charset:  charset,
	}
}

// maskPassword 掩盖密码（只显示前2个字符）
func maskPassword(pwd string) string {
	if len(pwd) == 0 {
		return "(empty)"
	}
	if len(pwd) <= 2 {
		return "***"
	}
	return pwd[:2] + "***"
}

// InitDatabase 初始化数据库连接
func InitDatabase() error {
	config := GetDatabaseConfig()

	// 构建MySQL连接字符串
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=%s&parseTime=True&loc=Local",
		config.User,
		config.Password,
		config.Host,
		config.Port,
		config.DBName,
		config.Charset,
	)

	// 配置Gorm日志
	logLevel := logger.Silent
	if GetEnv("GIN_MODE", "release") == "debug" {
		logLevel = logger.Info
	}

	// 连接数据库
	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
		NowFunc: func() time.Time {
			return time.Now().Local()
		},
	})

	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// 获取底层的sql.DB实例
	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}

	// 设置连接池参数
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	log.Println("✅ Database connected successfully")
	return nil
}

// CloseDatabase 关闭数据库连接
func CloseDatabase() error {
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
