package config

import (
	"context"
	"os"
	"strconv"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// GetEnv 获取环境变量，如果不存在则返回默认值
func GetEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

// GetEnvInt 获取环境变量（整型）
func GetEnvInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

// GetEnvBool 获取环境变量（布尔型）
func GetEnvBool(key string, defaultValue bool) bool {
	if value, exists := os.LookupEnv(key); exists {
		if boolVal, err := strconv.ParseBool(value); err == nil {
			return boolVal
		}
	}
	return defaultValue
}

// GetUseCloud 检查是否使用微信云开发
// 默认 false，自建后端使用 MySQL
func GetUseCloud() bool {
	return GetEnvBool("USE_CLOUD", false)
}

// GetAPIBase 返回 API 基地址，可供前端设置、或者在后端生成链接时使用
func GetAPIBase() string {
	if v := os.Getenv("API_BASE"); v != "" {
		return v
	}
	return "http://localhost:8080"
}

// StorageConfig holds object storage settings (S3-compatible)
type StorageConfig struct {
	Provider  string // e.g. "s3" or "minio"
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	Region    string
	UseSSL    bool
	PublicURL string // optional base URL for generating public links
}

// StorageClient is a global S3/Minio client; nil if object storage not configured
var StorageClient interface{} // will hold *minio.Client

// GetStorageConfig reads storage settings from environment
func GetStorageConfig() *StorageConfig {
	return &StorageConfig{
		Provider:  GetEnv("STORAGE_PROVIDER", ""),
		Endpoint:  GetEnv("STORAGE_ENDPOINT", ""),
		AccessKey: GetEnv("STORAGE_ACCESS_KEY", ""),
		SecretKey: GetEnv("STORAGE_SECRET_KEY", ""),
		Bucket:    GetEnv("STORAGE_BUCKET", ""),
		Region:    GetEnv("STORAGE_REGION", ""),
		UseSSL:    GetEnvBool("STORAGE_USE_SSL", true),
		PublicURL: GetEnv("STORAGE_PUBLIC_URL", ""),
	}
}

// InitializeStorage sets up object storage client if configuration present
func InitializeStorage() error {
	cfg := GetStorageConfig()
	if cfg.Provider == "" || cfg.Endpoint == "" || cfg.AccessKey == "" || cfg.SecretKey == "" || cfg.Bucket == "" {
		// not configured
		return nil
	}
	// currently only S3-compatible providers supported via minio
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
		Region: cfg.Region,
	})
	if err != nil {
		return err
	}
	StorageClient = client

	// ensure bucket exists
	exists, err := client.BucketExists(context.Background(), cfg.Bucket)
	if err != nil {
		return err
	}
	if !exists {
		if err := client.MakeBucket(context.Background(), cfg.Bucket, minio.MakeBucketOptions{Region: cfg.Region}); err != nil {
			return err
		}
	}
	return nil
}
