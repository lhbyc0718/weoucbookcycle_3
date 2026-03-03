# WeOUC BookCycle

此仓库包含微信小程序前端和 Go/MySQL 后端。

## 环境配置

在根目录下有两个子项目：

- `backend/weoucbookcycle_go` - Go 后端服务，使用 GORM 连接 MySQL。
- `frontend/bookcycle--4-` - 微信小程序/React 模块。

请复制 `.env.example` 并命名为 `.env`，修改以下变量：

```dotenv
SERVER_PORT=8080
GIN_MODE=debug
API_ENV=development        # development/test/production
API_BASE=http://localhost:8080 # 后端地址
USE_CLOUD=false           # false 表示使用自建 MySQL
ENABLE_AUTO_MIGRATE=false # 生产环境默认关闭，可在开发开启
# MySQL 相关
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=weoucbookcycle
DB_CHARSET=utf8mb4
# 可选使用 DSN
# DB_DSN=user:pass@tcp(host:port)/dbname?charset=utf8mb4&parseTime=True&loc=Local

# JWT 密钥（必填）
JWT_SECRET=...随机字符串...

# TLS（若启用 HTTPS）
#TLS_CERT_FILE=/path/to/cert.pem
#TLS_KEY_FILE=/path/to/key.pem
``` 

> 微信小程序强制要求 HTTPS 域名，请在生产环境中配置证书并使用 TLS。


## 后端启动

```bash
cd backend/weoucbookcycle_go
go run main.go
```

可通过 `ENABLE_AUTO_MIGRATE=true` 在测试环境自动迁移数据库。

## 微信小程序开发

前端配置 `frontend/bookcycle--4-/app.json` 的 `config.apiBase` 指向后端地址。`useCloud` 设置为 `false` 表示不使用云开发。

## CI / Lint / 测试

仓库包含 GitHub Actions 工作流 `.github/workflows/ci.yml`。

- 后端运行 `go test ./...` 和 `go vet`。
- 前端运行 `npm run lint`。

代码规范建议：

- Go 使用 `go fmt`/`go vet`。
- 前端使用 `npm run lint`（基于 tsc）。

可以在根目录添加额外的 linters（golangci-lint, ESLint 等）。

## 单元测试示例

后端 `services/auth_service_test.go` 是一个简单样例。可添加更多测试文件。

---

以上配置在没有真实后端的情况下可用于开发；部署时只需将 `.env` 中 `API_BASE` 切换到线上地址，并在微信公众平台配置合法域名。
