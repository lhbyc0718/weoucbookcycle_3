# WeOUCBookCycle (海大图书循环) 📚♻️

> Ocean University of China (OUC) Campus Second-hand Book Trading Platform.
> 一个专注于中国海洋大学校园内的二手图书循环交易平台，致力于促进知识流动与资源节约。

## 🛠️ 技术栈 (Tech Stack)

### 💻 前端 (Frontend)
*   **Web 端**: React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Zustand (状态管理), React Router.
*   **小程序 (Mini Program)**: 微信小程序原生开发 (WXML, WXSS, JS), Vant Weapp (UI 组件库).

### 🔙 后端 (Backend)
*   **语言**: Go (Golang) 1.21+
*   **框架**: Gin Web Framework
*   **ORM**: GORM (Go Object Relational Mapping)

### 🗄️ 数据库与存储 (Database & Storage)
*   **关系型数据库**: MySQL 8.0
*   **缓存与消息队列**: Redis 7.0 (Stream, Pub/Sub)
*   **对象存储**: MinIO / S3 兼容存储 (用于图片上传)

### 🚀 部署与运维 (Deployment & DevOps)
*   **容器化**: Docker, Docker Compose
*   **CI/CD**: GitHub Actions
*   **反向代理**: Nginx

---

## ✨ 功能列表 (Features)

### 👤 用户模块 (User)
*   微信一键登录 / 手机号注册登录
*   个人资料管理 (头像、昵称、学院)
*   实名认证 (校园卡/学号验证)

### 📖 图书模块 (Book & Listing)
*   ISBN 扫码识别图书信息
*   发布图书出售/求购信息
*   图书搜索与筛选 (按分类、价格、学院)
*   多图上传与展示

### 💬 消息与社交 (Chat & Social)
*   实时聊天 (WebSocket)
*   消息通知 (系统通知、交易状态更新)
*   用户关注与粉丝

### 🛒 交易模块 (Transaction)
*   创建订单
*   在线支付 / 线下交易确认
*   订单状态流转 (待确认、进行中、已完成、已取消)
*   评价与评分

### 🔧 管理后台 (Admin Dashboard)
*   用户管理
*   图书审核
*   交易数据统计与可视化

---

## 📂 项目结构 (Project Structure)

```bash
weoucbookcycle/
├── .github/workflows/   # CI/CD workflows
├── backend/
│   └── weoucbookcycle_go/ # Go 后端源码
│       ├── config/      # 配置文件
│       ├── controllers/ # 控制器
│       ├── models/      # 数据模型
│       ├── routes/      # 路由定义
│       ├── services/    # 业务逻辑
│       └── main.go      # 入口文件
├── frontend/
│   ├── web/             # React Web 前端
│   └── weapp/           # 微信小程序源码
├── docker-compose.yml   # 容器编排文件
└── README.md            # 项目文档
```

---

## 🚀 快速开始 (Quick Start)

### 前置要求 (Prerequisites)
*   [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
*   [Go](https://go.dev/) 1.21+ (本地开发需要)
*   [Node.js](https://nodejs.org/) 18+ (本地开发需要)

### 1. 克隆项目 (Clone Repository)
```bash
git clone https://github.com/your-username/weoucbookcycle.git
cd weoucbookcycle
```

### 2. 配置环境变量 (Configure Environment)
项目根目录下没有默认的 `.env` 模板，你需要参考后端配置创建。

在 `backend/weoucbookcycle_go/` 下创建 `.env` 文件：
```env
# Server
SERVER_PORT=8080
GIN_MODE=debug
API_BASE=http://localhost:8080

# Database
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=weoucbookcycle

# Redis
REDIS_ADDR=redis:6379
REDIS_PASSWORD=
REDIS_DB=0

# Object Storage (MinIO Example)
STORAGE_PROVIDER=minio
STORAGE_ENDPOINT=minio:9000
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=books
STORAGE_REGION=us-east-1
STORAGE_USE_SSL=false
```

### 3. Docker 启动 (Run with Docker)
使用 Docker Compose 一键启动所有服务 (后端、Web、MySQL, Redis)。

```bash
docker-compose up -d --build
```

等待容器启动完成后：
*   **Web 前端**: 访问 `http://localhost:3000`
*   **后端 API**: 访问 `http://localhost:8080`
*   **API 健康检查**: `http://localhost:8080/health`

### 4. 本地开发 (Local Development)

#### 后端 (Backend)
```bash
cd backend/weoucbookcycle_go
go mod download
go run main.go
```

#### Web 前端 (Frontend Web)
```bash
cd frontend/web
npm install
npm run dev
```

#### 微信小程序 (Mini Program)
1.  下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2.  导入项目目录 `frontend/weapp`。
3.  修改 `app.js` 中的 `apiBase` 为 `http://localhost:8080` (确保勾选开发者工具中的"不校验合法域名")。

---

## 📚 接口文档 (API Documentation)

接口定义位于 `backend/weoucbookcycle_go/routes` 目录。
常见的 API 路由前缀：
*   `/api/v1/auth`: 认证相关
*   `/api/v1/books`: 图书管理
*   `/api/v1/users`: 用户信息
*   `/api/v1/chat`: 聊天消息

---

## 🐳 部署说明 (Deployment)

本项目完全支持 Docker 化部署。

### 生产环境部署建议
1.  **修改密码**: 务必修改 `docker-compose.yml` 和 `.env` 中的数据库与 Redis 密码。
2.  **HTTPS**: 建议在 Nginx 层配置 SSL 证书，或使用云服务商的负载均衡。
3.  **数据持久化**: `docker-compose.yml` 已经配置了 MySQL 和 Redis 的数据卷 (`volumes`)，确保数据不会因容器重启而丢失。

```bash
# 生产环境启动 (后台运行)
docker-compose up -d
```
