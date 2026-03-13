# 阿里云 OSS 配置指南

本文档提供了集成阿里云对象存储服务 (Aliyun Object Storage Service, OSS) 的详细步骤。

## 1. 预备条件

- 已有阿里云账户
- 已在阿里云控制台创建 OSS Bucket
- 已获取 AccessKey ID 和 AccessKey Secret

## 2. 阿里云 OSS 控制台设置

### 2.1 创建 Bucket

1. 登录 [阿里云控制台](https://oss.console.aliyun.com/)
2. 点击"创建 Bucket"
3. 填写配置：
   - **Bucket 名称**: 例如 `weoucbookcycle-uploads`
   - **地域**: 选择离用户最近的地域（如华东1 - 杭州）
   - **存储类型**: 选择"标准存储"
   - **读写权限**: 选择"公开读"（便于直接访问图片）

4. 点击"创建"

### 2.2 获取 AccessKey

1. 进入右上角个人账户 → 【AccessKey 管理】
2. 进入【当前用户信息】页面
3. 点击【创建 AccessKey】
4. 复制并保存：
   - **AccessKey ID**
   - **AccessKey Secret**

⚠️ **重要**: AccessKey Secret 仅显示一次，请妥善保管

### 2.3 配置 CORS（跨域访问）

如果前端需要直接访问 OSS 资源：

1. 在 OSS 控制台选择 Bucket
2. 进入【跨域设置】tab
3. 点击"创建规则"，设置：
   ```
   来源: *
   允许操作方式: 勾选 GET, HEAD, PUT, POST, DELETE
   允许 Headers: *
   ```

## 3. 后端环境变量配置

在 `.env` 或系统环境变量中添加：

```bash
# 阿里云 OSS 配置
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
OSS_BUCKET=weoucbookcycle-uploads
OSS_ACCESS_KEY_ID=your_access_key_id_here
OSS_ACCESS_KEY_SECRET=your_access_key_secret_here
OSS_REGION=cn-hangzhou

# 可选：直接访问前缀
OSS_DIRECT_ACCESS_PREFIX=https://weoucbookcycle-uploads.oss-cn-hangzhou.aliyuncs.com

# 启用 OSS 存储
USE_OSS_STORAGE=true
```

### 3.1 参数说明

| 参数 | 说明 | 例子 |
|------|------|------|
| `OSS_ENDPOINT` | Bucket 所在地域的 OSS 域名 | oss-cn-hangzhou.aliyuncs.com |
| `OSS_BUCKET` | 创建的 Bucket 名称 | weoucbookcycle-uploads |
| `OSS_ACCESS_KEY_ID` | 阿里云 AccessKey ID | LTAIDG... |
| `OSS_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret | MzBkg... |
| `OSS_REGION` | 地域标识 | cn-hangzhou |
| `OSS_DIRECT_ACCESS_PREFIX` | OSS 文件直接访问 URL 前缀 | https://xxx.oss-cn-hangzhou.aliyuncs.com |

### 3.2 地域对应表

| 地域 | Endpoint | REGION |
|------|----------|--------|
| 华东1（杭州） | oss-cn-hangzhou.aliyuncs.com | cn-hangzhou |
| 华东2（上海） | oss-cn-shanghai.aliyuncs.com | cn-shanghai |
| 华北2（北京） | oss-cn-beijing.aliyuncs.com | cn-beijing |
| 华北1（青岛） | oss-cn-qingdao.aliyuncs.com | cn-qingdao |
| 华南1（深圳） | oss-cn-shenzhen.aliyuncs.com | cn-shenzhen |

## 4. 后端代码实现

### 4.1 OSS 客户端初始化

```go
package config

import (
    "fmt"
    "log"
    
    "github.com/aliyun/aliyun-oss-go-sdk/oss"
)

var OSSClient *oss.Client
var OSSBucket *oss.Bucket

// InitOSS 初始化 OSS 客户端
func InitOSS() error {
    endpoint := GetEnv("OSS_ENDPOINT", "")
    accessKeyID := GetEnv("OSS_ACCESS_KEY_ID", "")
    accessKeySecret := GetEnv("OSS_ACCESS_KEY_SECRET", "")
    bucketName := GetEnv("OSS_BUCKET", "")

    if endpoint == "" || accessKeyID == "" || accessKeySecret == "" || bucketName == "" {
        log.Println("⚠️  OSS configuration incomplete, skipping OSS initialization")
        return nil
    }

    var err error
    OSSClient, err = oss.New(endpoint, accessKeyID, accessKeySecret)
    if err != nil {
        return fmt.Errorf("failed to create OSS client: %w", err)
    }

    OSSBucket, err = OSSClient.Bucket(bucketName)
    if err != nil {
        return fmt.Errorf("failed to get OSS bucket: %w", err)
    }

    log.Println("✅ OSS client initialized successfully")
    return nil
}
```

### 4.2 文件上传实现

```go
package services

import (
    "fmt"
    "mime/multipart"
    "path/filepath"
    "time"

    "weoucbookcycle/config"
)

// UploadFileToOSS 上传文件到阿里云 OSS
func UploadFileToOSS(file *multipart.FileHeader, folder string) (string, error) {
    if config.OSSBucket == nil {
        return "", fmt.Errorf("OSS not configured")
    }

    // 打开文件
    src, err := file.Open()
    if err != nil {
        return "", err
    }
    defer src.Close()

    // 生成 OSS 对象键
    ext := filepath.Ext(file.Filename)
    timestamp := time.Now().Format("20060102150405")
    uuid := GenerateUUID() // 使用 uuid 工具函数
    objectKey := fmt.Sprintf("%s/%s-%s%s", folder, timestamp, uuid, ext)

    // 上传文件到 OSS
    err = config.OSSBucket.PutObject(objectKey, src)
    if err != nil {
        return "", fmt.Errorf("failed to upload to OSS: %w", err)
    }

    // 返回 OSS URL
    ossDirectAccessPrefix := config.GetEnv("OSS_DIRECT_ACCESS_PREFIX", "")
    if ossDirectAccessPrefix != "" {
        return fmt.Sprintf("%s/%s", ossDirectAccessPrefix, objectKey), nil
    }

    // 如果没有配置直接访问前缀，使用生成的 URL
    endpoint := config.GetEnv("OSS_ENDPOINT", "")
    bucket := config.GetEnv("OSS_BUCKET", "")
    return fmt.Sprintf("https://%s.%s/%s", bucket, endpoint, objectKey), nil
}
```

### 4.3 更新上传控制器

```go
// 在 upload_controller.go 中修改 UploadFile 方法

const (
    MaxFileSize = 5 * 1024 * 1024 // 5MB
)

// UploadFile 处理文件上传
func UploadFile(c *gin.Context) {
    file, err := c.FormFile("file")
    if err != nil {
        c.JSON(400, gin.H{
            "code":    40000,
            "message": "No file provided",
        })
        return
    }

    // 验证文件大小
    if file.Size > int64(MaxFileSize) {
        c.JSON(400, gin.H{
            "code":    40001,
            "message": "File size exceeds limit (5MB)",
        })
        return
    }

    // 验证文件类型
    allowedTypes := map[string]bool{
        "image/jpeg": true,
        "image/png":  true,
        "image/gif":  true,
        "image/webp": true,
    }

    if !allowedTypes[file.Header.Get("Content-Type")] {
        c.JSON(400, gin.H{
            "code":    40002,
            "message": "Unsupported file type",
        })
        return
    }

    useOSS := config.GetEnv("USE_OSS_STORAGE", "false") == "true"
    var url string

    if useOSS {
        // 上传到 OSS
        url, err = services.UploadFileToOSS(file, "chat-images")
    } else {
        // 本地存储
        url, err = services.UploadFileLocal(file)
    }

    if err != nil {
        c.JSON(500, gin.H{
            "code":    50000,
            "message": "Upload failed",
        })
        return
    }

    c.JSON(200, gin.H{
        "code":    20000,
        "message": "Upload successful",
        "data": gin.H{
            "url":  url,
            "name": file.Filename,
            "size": file.Size,
        },
    })
}
```

## 5. 主程序集成

在 `main.go` 的初始化部分添加 OSS 初始化：

```go
func main() {
    // ... 其他初始化代码 ...
    
    if err := config.InitOSS(); err != nil {
        log.Fatalf("OSS initialization failed: %v", err)
    }
    
    // ... 继续其他初始化 ...
}
```

## 6. 依赖安装

### 6.1 Go OSS SDK 安装

```bash
go get github.com/aliyun/aliyun-oss-go-sdk/oss
```

### 6.2 go.mod 依赖

```go
require (
    github.com/aliyun/aliyun-oss-go-sdk v2.2.10+incompatible
)
```

## 7. 测试连接

### 7.1 后端连接测试

```go
// 在 monitor_controller.go 或类似的地方添加测试端点

// GetOSSStatus 获取 OSS 连接状态
func GetOSSStatus(c *gin.Context) {
    if config.OSSBucket == nil {
        c.JSON(200, gin.H{
            "code":    20000,
            "message": "OSS status",
            "data": gin.H{
                "connected": false,
                "reason":    "OSS not configured",
            },
        })
        return
    }

    // 尝试列出 OSS 中的对象（只列出前1个来测试连接）
    _, err := config.OSSBucket.ListObjects(
        oss.MaxKeys(1),
        oss.Prefix("chat-images/"),
    )

    if err != nil {
        c.JSON(200, gin.H{
            "code":    20000,
            "message": "OSS status",
            "data": gin.H{
                "connected": false,
                "error":     err.Error(),
            },
        })
    } else {
        c.JSON(200, gin.H{
            "code":    20000,
            "message": "OSS status",
            "data": gin.H{
                "connected": true,
                "bucket":    config.GetEnv("OSS_BUCKET", ""),
                "endpoint":  config.GetEnv("OSS_ENDPOINT", ""),
            },
        })
    }
}
```

### 7.2 前端测试上传

```typescript
// 在前端测试图片上传
const testOSSUpload = async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
    });
    
    const data = await res.json();
    console.log('Upload response:', data);
    // data.data.url 应该是 OSS 的 URL 而不是本地路径
};
```

## 8. 优化配置

### 8.1 图片处理（实时转换）

OSS 支持实时图片处理，可在 URL 后添加参数：

```
原始 URL: https://bucket.oss-cn-hangzhou.aliyuncs.com/image.jpg

// 缩放到 200x200
https://bucket.oss-cn-hangzhou.aliyuncs.com/image.jpg?x-oss-process=image/resize,w_200,h_200

// 压缩质量
https://bucket.oss-cn-hangzhou.aliyuncs.com/image.jpg?x-oss-process=image/quality,q_75
```

### 8.2 自定义域名

在阿里云 OSS 控制台绑定自定义域名后，可使用自定义域名访问文件：

```
https://uploads.weoucbookcycle.com/chat-images/xxx.jpg
```

## 9. 故障排除

### 9.1 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `InvalidAccessKeyId` | AccessKey ID 错误 | 检查 OSS_ACCESS_KEY_ID 环境变量 |
| `SignatureDoesNotMatch` | AccessKey Secret 错误 | 检查 OSS_ACCESS_KEY_SECRET 环保量 |
| `NoSuchBucket` | Bucket 名称错误 | 检查 OSS_BUCKET 是否正确 |
| `InvalidBucketName` | Bucket 名称不符合规范 | Bucket 名称必须为小写字母、数字、短划线 |
| `AccessDenied` | 权限不足 | 检查 RAM 权限设置 |

### 9.2 权限配置

如果遇到权限问题，在阿里云 RAM 中为 AccessKey 配置以下权限：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "oss:PutObject",
        "oss:GetObject",
        "oss:DeleteObject",
        "oss:ListObjects"
      ],
      "Resource": [
        "arn:acs:oss:*:*:weoucbookcycle-uploads",
        "arn:acs:oss:*:*:weoucbookcycle-uploads/*"
      ]
    }
  ]
}
```

## 10. 迁移现有数据

如果已有本地存储的文件，可创建迁移脚本：

```go
// 迁移本地文件到 OSS
func MigrateToOSS(localDir string) error {
    files, err := ioutil.ReadDir(localDir)
    if err != nil {
        return err
    }

    for _, file := range files {
        if file.IsDir() {
            continue
        }

        filePath := filepath.Join(localDir, file.Name())
        src, err := os.Open(filePath)
        if err != nil {
            continue
        }

        objectKey := fmt.Sprintf("chat-images/%s", file.Name())
        if err := config.OSSBucket.PutObject(objectKey, src); err != nil {
            src.Close()
            continue
        }

        src.Close()
        os.Remove(filePath) // 上传成功后删除本地文件
    }

    return nil
}
```

## 11. 成本估算

阿里云 OSS 定价（按华东1举例）：

- **存储**：¥0.12 元/GB/月 (标准存储)
- **流量**：¥0.50 元/GB (下行流量)
- **请求**：¥0.01 元/万次 (Put 请求)

示例：100 GB 用户数据 + 500 GB 下行流量
- 月存储费用：100 * 0.12 = ¥12
- 月下行费用：500 * 0.50 = ¥250
- 总计：约 ¥262/月

## 12. 安全最佳实践

1. **定期轮换密钥**: 每90天轮换一次 AccessKey
2. **使用 RAM 子账户**: 为应用创建专用 RAM 用户，限制权限
3. **启用版本控制**: 防止误删除
4. **配置生命周期规则**: 自动删除过期临时文件
5. **启用日志**:
   - 在 OSS 控制台启用日志记录
   - 定期审查访问日志，检测异常

## 13. 监控和日志

### 13.1 CloudWatch/CloudMonitor 监控

在阿里云控制台配置告警规则：

- 上传请求失败率 > 5%
- 下行流量突增
- 存储容量预警

### 13.2 日志分析

利用阿里云 OSS Logging 服务导出到 Bucket，使用 Logstash/ELK 分析访问模式

---

**版本**: 1.0  
**最后更新**: 2024年03月  
**支持**: 如遇问题，请参考阿里云 [OSS 官方文档](https://help.aliyun.com/product/31815.html)
