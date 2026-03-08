package utils

import (
	"context"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"weoucbookcycle_go/config"

	"github.com/gin-gonic/gin"
	"github.com/minio/minio-go/v7"
)

// UploadConfig 上传配置
type UploadConfig struct {
	MaxFileSize    int64    // 最大文件大小（字节）
	AllowedFormats []string // 允许的文件格式
	UploadPath     string   // 上传路径
	GenerateThumb  bool     // 是否生成缩略图
	ThumbWidth     int      // 缩略图宽度
	ThumbHeight    int      // 缩略图高度
	UseRedisCache  bool     // 是否使用Redis缓存
}

// DefaultUploadConfig 默认上传配置
var DefaultUploadConfig = &UploadConfig{
	MaxFileSize:    5 * 1024 * 1024, // 5MB
	AllowedFormats: []string{".jpg", ".jpeg", ".png", ".gif", ".webp"},
	UploadPath:     "./uploads",
	GenerateThumb:  true,
	ThumbWidth:     300,
	ThumbHeight:    300,
	UseRedisCache:  true,
}

// UploadResult 上传结果
type UploadResult struct {
	OriginalURL string `json:"original_url"` // 原始图片URL
	ThumbURL    string `json:"thumb_url"`    // 缩略图URL
	FileSize    int64  `json:"file_size"`    // 文件大小
	FileName    string `json:"file_name"`    // 文件名
	Width       int    `json:"width"`        // 图片宽度
	Height      int    `json:"height"`       // 图片高度
}

// FileUploader 文件上传器
type FileUploader struct {
	config *UploadConfig
}

// NewFileUploader 创建文件上传器实例
func NewFileUploader(config ...*UploadConfig) *FileUploader {
	cfg := DefaultUploadConfig
	if len(config) > 0 && config[0] != nil {
		cfg = config[0]
	}
	return &FileUploader{config: cfg}
}

// uploadToStorage sends data to configured object storage and returns public URL
func (fu *FileUploader) uploadToStorage(ctx context.Context, reader io.Reader, size int64, fileName, contentType string) (string, error) {
	cfg := config.GetStorageConfig()
	client, ok := config.StorageClient.(*minio.Client)
	if !ok || client == nil {
		return "", fmt.Errorf("storage client not available")
	}
	// organize by date folder
	dir := time.Now().Format("2006/01/02")
	objectName := fmt.Sprintf("%s/%s", dir, fileName)
	opts := minio.PutObjectOptions{ContentType: contentType}
	_, err := client.PutObject(ctx, cfg.Bucket, objectName, reader, size, opts)
	if err != nil {
		return "", err
	}
	// build URL
	if cfg.PublicURL != "" {
		return fmt.Sprintf("%s/%s", strings.TrimRight(cfg.PublicURL, "/"), objectName), nil
	}
	protocol := "https"
	if !cfg.UseSSL {
		protocol = "http"
	}
	return fmt.Sprintf("%s://%s/%s/%s", protocol, cfg.Endpoint, cfg.Bucket, objectName), nil
}

// UploadFile 上传单个文件
func (fu *FileUploader) UploadFile(c *gin.Context, fieldName string) (*UploadResult, error) {
	file, err := c.FormFile(fieldName)
	if err != nil {
		return nil, fmt.Errorf("failed to get file: %w", err)
	}

	// 验证文件大小
	if file.Size > fu.config.MaxFileSize {
		return nil, fmt.Errorf("file size exceeds maximum allowed size of %d bytes", fu.config.MaxFileSize)
	}

	// 验证文件格式
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !fu.isAllowedFormat(ext) {
		return nil, fmt.Errorf("file format %s is not allowed", ext)
	}

	// 打开文件
	src, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer src.Close()

	// 生成文件名
	fileName := generateFileName(file.Filename)

	result := &UploadResult{
		FileSize: file.Size,
		FileName: fileName,
	}

	// 如果已配置对象存储则直接上传
	if config.StorageClient != nil {
		url, err := fu.uploadToStorage(c.Request.Context(), src, file.Size, fileName, file.Header.Get("Content-Type"))
		if err != nil {
			return nil, fmt.Errorf("storage upload failed: %w", err)
		}
		result.OriginalURL = url
		return result, nil
	}

	// fallback to local disk
	filePath := filepath.Join(fu.config.UploadPath, fileName)
	// 创建目录
	if err := os.MkdirAll(fu.config.UploadPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create upload directory: %w", err)
	}

	// 保存文件
	dst, err := os.Create(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to create file: %w", err)
	}
	defer dst.Close()

	// reset reader to beginning by reopening
	src2, _ := file.Open()
	defer src2.Close()
	if _, err := io.Copy(dst, src2); err != nil {
		return nil, fmt.Errorf("failed to save file: %w", err)
	}

	// 构建结果
	result.OriginalURL = fmt.Sprintf("/uploads/%s", fileName)

	// 异步缓存文件信息到Redis
	if fu.config.UseRedisCache && config.RedisClient != nil {
		go fu.cacheFileMetadata(fileName, result)
	}

	return result, nil
}

// 全局并发上传限制
var uploadSemaphore = make(chan struct{}, 20)

// UploadFiles 上传多个文件（并发处理）
func (fu *FileUploader) UploadFiles(c *gin.Context, fieldName string) ([]*UploadResult, error) {
	form, err := c.MultipartForm()
	if err != nil {
		return nil, fmt.Errorf("failed to get multipart form: %w", err)
	}

	files := form.File[fieldName]
	if len(files) == 0 {
		return nil, fmt.Errorf("no files found for field: %s", fieldName)
	}

	// 使用goroutine并发上传多个文件
	var wg sync.WaitGroup
	var mu sync.Mutex
	results := make([]*UploadResult, 0, len(files))
	errors := make([]error, 0)
	errorChan := make(chan error, len(files))

	for _, file := range files {
		wg.Add(1)
		go func(f *multipart.FileHeader) {
			defer wg.Done()

			// 打开文件
			src, err := f.Open()
			if err != nil {
				errorChan <- fmt.Errorf("failed to open file %s: %w", f.Filename, err)
				return
			}
			defer src.Close()

			// 验证文件大小
			if f.Size > fu.config.MaxFileSize {
				errorChan <- fmt.Errorf("file %s exceeds maximum size", f.Filename)
				return
			}

			// 验证文件魔数（Magic Number）
			buffer := make([]byte, 512)
			_, err = src.Read(buffer)
			if err != nil && err != io.EOF {
				errorChan <- fmt.Errorf("failed to read file header for %s: %w", f.Filename, err)
				return
			}
			// 重置文件指针
			if _, err := src.Seek(0, 0); err != nil {
				errorChan <- fmt.Errorf("failed to seek file %s: %w", f.Filename, err)
				return
			}

			// 获取并发令牌
			uploadSemaphore <- struct{}{}
			defer func() { <-uploadSemaphore }()

			contentType := http.DetectContentType(buffer)
			if !strings.HasPrefix(contentType, "image/") {
				errorChan <- fmt.Errorf("invalid file type for %s: %s, only images are allowed", f.Filename, contentType)
				return
			}

			// 验证文件格式
			ext := strings.ToLower(filepath.Ext(f.Filename))
			if !fu.isAllowedFormat(ext) {
				errorChan <- fmt.Errorf("file format %s not allowed for %s", ext, f.Filename)
				return
			}

			// 生成文件名
			fileName := generateFileName(f.Filename)
			filePath := filepath.Join(fu.config.UploadPath, fileName)

			// 创建目录
			if err := os.MkdirAll(fu.config.UploadPath, 0755); err != nil {
				errorChan <- fmt.Errorf("failed to create directory for %s: %w", f.Filename, err)
				return
			}

			// 如果配置了对象存储则先上传
			result := &UploadResult{
				FileSize: f.Size,
				FileName: fileName,
			}
			if config.StorageClient != nil {
				url, err := fu.uploadToStorage(context.Background(), src, f.Size, fileName, f.Header.Get("Content-Type"))
				if err != nil {
					errorChan <- fmt.Errorf("storage upload failed for %s: %w", f.Filename, err)
					return
				}
				result.OriginalURL = url
			} else {
				// 保存文件到本地
				dst, err := os.Create(filePath)
				if err != nil {
					errorChan <- fmt.Errorf("failed to create file %s: %w", f.Filename, err)
					return
				}
				defer dst.Close()

				src2, _ := f.Open()
				defer src2.Close()
				if _, err := io.Copy(dst, src2); err != nil {
					errorChan <- fmt.Errorf("failed to save file %s: %w", f.Filename, err)
					return
				}
				result.OriginalURL = fmt.Sprintf("/uploads/%s", fileName)
			}

			// 添加到结果列表（加锁）
			mu.Lock()
			results = append(results, result)
			mu.Unlock()

			// 异步缓存到Redis
			if fu.config.UseRedisCache && config.RedisClient != nil {
				go fu.cacheFileMetadata(fileName, result)
			}
		}(file)
	}

	// 等待所有上传完成
	wg.Wait()
	close(errorChan)

	// 收集错误
	for err := range errorChan {
		errors = append(errors, err)
	}

	// 如果有错误，返回
	if len(errors) > 0 {
		return results, fmt.Errorf("%d upload(s) failed: %v", len(errors), errors)
	}

	return results, nil
}

// cacheFileMetadata 缓存文件元数据到Redis
func (fu *FileUploader) cacheFileMetadata(fileName string, result *UploadResult) {
	if config.RedisClient == nil {
		return
	}

	ctx := context.Background()
	key := fmt.Sprintf("file:metadata:%s", fileName)

	metadata := map[string]interface{}{
		"original_url": result.OriginalURL,
		"file_size":    result.FileSize,
		"file_name":    result.FileName,
		"cached_at":    time.Now().Unix(),
	}

	// 设置过期时间（24小时）
	config.RedisClient.HSet(ctx, key, metadata)
	config.RedisClient.Expire(ctx, key, 24*time.Hour)
}

// GetFileMetadata 从Redis获取文件元数据
func (fu *FileUploader) GetFileMetadata(fileName string) (map[string]string, error) {
	if config.RedisClient == nil {
		return nil, fmt.Errorf("redis not available")
	}

	ctx := context.Background()
	key := fmt.Sprintf("file:metadata:%s", fileName)

	return config.RedisClient.HGetAll(ctx, key).Result()
}

// isAllowedFormat 检查文件格式是否允许
func (fu *FileUploader) isAllowedFormat(ext string) bool {
	for _, allowed := range fu.config.AllowedFormats {
		if strings.EqualFold(ext, allowed) {
			return true
		}
	}
	return false
}

// generateFileName 生成唯一文件名
func generateFileName(originalName string) string {
	ext := filepath.Ext(originalName)
	name := strings.TrimSuffix(originalName, ext)
	timestamp := time.Now().Format("20060102150405")
	randomStr := randomString(8)
	return fmt.Sprintf("%s_%s_%s%s", name, timestamp, randomStr, ext)
}

// DeleteFile 删除文件
func (fu *FileUploader) DeleteFile(fileName string) error {
	filePath := filepath.Join(fu.config.UploadPath, fileName)

	// 删除文件
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete file: %w", err)
	}

	// 删除Redis缓存
	if fu.config.UseRedisCache && config.RedisClient != nil {
		go func() {
			ctx := context.Background()
			key := fmt.Sprintf("file:metadata:%s", fileName)
			config.RedisClient.Del(ctx, key)
		}()
	}

	return nil
}

// GetFileStats 获取文件统计信息
func (fu *FileUploader) GetFileStats() map[string]interface{} {
	var totalSize int64
	var fileCount int

	err := filepath.Walk(fu.config.UploadPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			totalSize += info.Size()
			fileCount++
		}
		return nil
	})

	if err != nil {
		log.Printf("Failed to calculate file stats: %v", err)
	}

	return map[string]interface{}{
		"total_size":  totalSize,
		"file_count":  fileCount,
		"upload_path": fu.config.UploadPath,
	}
}

// CleanupOldFiles 清理旧文件（异步任务）
func (fu *FileUploader) CleanupOldFiles(days int) error {
	cutoffTime := time.Now().AddDate(0, 0, -days)
	var deletedCount int

	err := filepath.Walk(fu.config.UploadPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && info.ModTime().Before(cutoffTime) {
			if err := os.Remove(path); err == nil {
				deletedCount++
			}
		}
		return nil
	})

	log.Printf("Cleaned up %d old files (older than %d days)", deletedCount, days)
	return err
}

func randomString(n int) string {
	const letterBytes = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letterBytes[time.Now().UnixNano()%int64(len(letterBytes))]
	}
	return string(b)
}
