package config

import (
	"context"
	"os"
	"strconv"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	elasticsearch "github.com/elastic/go-elasticsearch/v8"
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
	// Support both generic STORAGE_* env vars and OSS-specific env vars for compatibility.
	// OSS_* variables are treated as fallbacks if STORAGE_* are not provided.
	provider := GetEnv("STORAGE_PROVIDER", "")
	if provider == "" {
		provider = GetEnv("OSS_PROVIDER", "oss") // default to "oss" when using OSS vars
	}

	endpoint := GetEnv("STORAGE_ENDPOINT", "")
	if endpoint == "" {
		endpoint = GetEnv("OSS_ENDPOINT", "")
	}

	access := GetEnv("STORAGE_ACCESS_KEY", "")
	if access == "" {
		access = GetEnv("OSS_ACCESS_KEY_ID", "")
	}

	secret := GetEnv("STORAGE_SECRET_KEY", "")
	if secret == "" {
		secret = GetEnv("OSS_ACCESS_KEY_SECRET", "")
	}

	bucket := GetEnv("STORAGE_BUCKET", "")
	if bucket == "" {
		bucket = GetEnv("OSS_BUCKET", "")
	}

	region := GetEnv("STORAGE_REGION", "")
	if region == "" {
		region = GetEnv("OSS_REGION", "")
	}

	useSSL := GetEnvBool("STORAGE_USE_SSL", true)
	// 不提供 OSS_USE_SSL，默认使用 STORAGE_USE_SSL

	publicURL := GetEnv("STORAGE_PUBLIC_URL", "")
	if publicURL == "" {
		publicURL = GetEnv("OSS_DIRECT_ACCESS_PREFIX", "")
	}

	return &StorageConfig{
		Provider:  provider,
		Endpoint:  endpoint,
		AccessKey: access,
		SecretKey: secret,
		Bucket:    bucket,
		Region:    region,
		UseSSL:    useSSL,
		PublicURL: publicURL,
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

// ElasticClient is the global Elasticsearch client
var ElasticClient *elasticsearch.Client

// InitializeElastic initializes the Elasticsearch client
func InitializeElastic() error {
	cfg := elasticsearch.Config{
		Addresses: []string{
			GetEnv("ELASTICSEARCH_URL", "http://localhost:9200"),
		},
	}

	es, err := elasticsearch.NewClient(cfg)
	if err != nil {
		return err
	}

	// Check connection
	_, err = es.Info()
	if err != nil {
		return err
	}

	ElasticClient = es
	return nil
}

// GetElasticClient returns the global Elasticsearch client
func GetElasticClient() *elasticsearch.Client {
	return ElasticClient
}
