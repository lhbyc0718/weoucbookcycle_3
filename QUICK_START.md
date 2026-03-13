# 🚀 快速启动指南 - 新功能测试

本指南帮助你快速启动整个应用并测试新添加的聊天功能改进。

## ⚡ 5分钟快速开始

### 第一步：启动后端服务

```bash
cd backend/weoucbookcycle_go

# 1. 安装依赖
go mod tidy

# 2. 启动服务
go run main.go
```

**预期输出：**
```
✅ Database initialized successfully
✅ Redis client initialized successfully  
✅ Starting server on :8080
✅ Swagger docs available at http://localhost:8080/api/swagger
```

### 第二步：启动前端开发服务器

```bash
cd frontend/web

# 1. 安装依赖（如果未安装）
npm install

# 2. 启动开发服务器
npm run dev
```

**预期输出：**
```
  VITE v4.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

### 第三步：打开应用

打开浏览器访问: **http://localhost:5173**

---

## 🧪 功能快速测试

### 测试 1：表情功能 (2分钟)

**步骤：**
1. 登录到两个不同的账户（或打开两个浏览器标签）
2. 打开聊天页面
3. 点击 😊 表情按钮
4. 选择一个表情（例如 😀）

**验证：**
- ✅ 表情选择器弹出
- ✅ 表情自动插入输入框
- ✅ 对方收到的消息包含表情

---

### 测试 2：图片上传 (3分钟)

**准备：**
- 准备一张小于 5MB 的 JPG 或 PNG 图片

**步骤：**
1. 打开聊天页面
2. 点击 📎 图片按钮
3. 选择或拖拽图片
4. 观察上传进度

**验证：**
- ✅ 显示上传进度条 (0-100%)
- ✅ 上传完成后显示成功提示
- ✅ 图片在聊天中显示
- ✅ 对方能看到这张图片

---

### 测试 3：混合内容 (1分钟)

**步骤：**
1. 在输入框输入："😊 看看我发的图"
2. 上传一张图片
3. 发送

**验证：**
- ✅ 消息同时包含表情、文字和图片
- ✅ 对方收到完整的消息

---

## 🛠️ 环境变量配置

如需启用阿里云 OSS 存储：

### 创建 .env 文件 (可选)

在项目根目录创建 `.env` 文件：

```bash
# 最小配置 (本地存储 - 默认)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
REDIS_ADDR=localhost:6379

# OSS 配置 (可选)
USE_OSS_STORAGE=false
# OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
# OSS_BUCKET=your-bucket
# OSS_ACCESS_KEY_ID=xxx
# OSS_ACCESS_KEY_SECRET=xxx
```

### 后端读取 .env

```bash
# 后端会自动读取同目录的 .env 文件
# 如需手动指定，可通过环境变量
export DB_HOST=localhost
go run main.go
```

---

## 📊 API 端点快速参考

### 表情 API

```bash
# 获取所有表情
curl http://localhost:8080/api/emojis

# 获取表情分类
curl http://localhost:8080/api/emojis/categories

# 获取特定分类的表情
curl "http://localhost:8080/api/emojis/category?category=faces"
```

### 文件上传 API

```bash
# 上传图片
curl -X POST -F "file=@/path/to/image.jpg" \
  http://localhost:8080/api/upload
```

**响应示例：**
```json
{
  "code": 20000,
  "message": "Upload successful",
  "data": {
    "url": "http://localhost:8080/uploads/image.jpg",
    "name": "image.jpg",
    "size": 102400
  }
}
```

---

## 📁 新增文件列表

### 后端文件
```
backend/weoucbookcycle_go/
├── controllers/
│   └── emoji_controller.go          (新建)
├── utils/
│   └── emoji.go                     (新建)
├── routes/
│   └── routes.go                    (已修改 - 添加emoji路由)
└── controllers/
    └── upload_controller.go         (已修改 - 统一响应格式)
```

### 前端文件
```
frontend/web/src/
├── components/
│   └── EmojiPicker.tsx              (新建)
└── pages/
    └── ChatDetail.tsx               (已修改 - 集成表情和上传改进)
```

### 文档文件
```
项目根目录/
├── OSS_CONFIGURATION.md             (新建 - OSS配置指南)
├── CHAT_IMPROVEMENTS_CHANGELOG.md   (新建 - 改进总结)
├── TESTING_GUIDE.md                 (新建 - 测试指南)
├── QUICK_START.md                   (本文件)
└── .env.example                     (新建 - 环境变量示例)
```

---

## 🔍 故障排除

### 问题 1：后端无法启动

**错误信息：**
```
failed to connect to database
```

**解决方案：**
```bash
# 检查 MySQL 是否运行
mysql -u root -p

# 检查 Redis 是否运行
redis-cli ping
```

### 问题 2：表情无法加载

**错误信息：**
```
Failed to fetch emojis
```

**解决方案：**
```bash
# 检查后端是否正常运行
curl http://localhost:8080/api/emojis

# 检查浏览器控制台错误信息 (F12)
```

### 问题 3：图片上传失败

**错误信息：**
```
图片上传失败
```

**检查List：**
- [ ] 图片大小是否超过 5MB？
- [ ] 后端是否正常运行？
- [ ] 网络连接是否正常？
- [ ] 浏览器控制台是否有 CORS 错误？

**调试步骤：**
```bash
# 打开浏览器开发者工具 (F12)
# Network 标签 → 选择 POST /api/upload
# 查看请求头和响应体内容
```

### 问题 4：表情显示为方块

**原因：**
浏览器或系统不支持该 Unicode 表情

**解决方案：**
- 更新浏览器到最新版本
- 安装字体支持 (如 Noto Color Emoji)
- 在 Windows 上，确保已安装 Segoe UI Emoji 字体

---

## 🧬 技术栈验证

运行以下命令验证环境：

```bash
# 检查 Go 版本 (需要 1.18+)
go version

# 检查 Node 版本 (需要 14+)
node --version

# 检查 npm 版本 (需要 6+)
npm --version

# 检查 MySQL 版本
mysql --version

# 检查 Redis 版本
redis-cli --version
```

**预期版本：**
- Go: 1.18+
- Node: 14.0.0+
- npm: 6.0.0+
- MySQL: 5.7+
- Redis: 6.0+

---

## 📚 完整文档导引

| 文档 | 用途 |
|------|------|
| [QUICK_START.md](QUICK_START.md) | 快速开始指南 (本文件) |
| [OSS_CONFIGURATION.md](OSS_CONFIGURATION.md) | 阿里云 OSS 配置详解 |
| [CHAT_IMPROVEMENTS_CHANGELOG.md](CHAT_IMPROVEMENTS_CHANGELOG.md) | 功能改进详细说明 |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | 完整的测试清单 |
| [README.md](README.md) | 项目概述 |

---

## 💡 下一步操作

### 第1阶段：基础验证 ✅
- [ ] 启动后端服务
- [ ] 启动前端服务  
- [ ] 打开应用
- [ ] 快速测试表情功能
- [ ] 快速测试图片上传

### 第2阶段：完整测试 (参考 TESTING_GUIDE.md)
- [ ] 完整的功能测试
- [ ] 错误处理验证
- [ ] 性能测试
- [ ] 跨浏览器兼容性测试

### 第3阶段：生产部署 (可选)
- [ ] 配置 OSS 存储（参考 OSS_CONFIGURATION.md）
- [ ] 构建前端生产版本
- [ ] 部署到服务器
- [ ] 配置域名和 HTTPS

---

## 🎯 常见功能操作

### 发送表情消息
```
1. 打开聊天
2. 点击😊表情按钮
3. 选择表情 → 自动插入
4. 点击发送或按 Enter
```

### 发送图片消息
```
1. 打开聊天
2. 点击📎图片按钮 或 拖拽图片
3. 等待上传完成 (看进度条)
4. 编辑文本 (可选)
5. 点击发送或按 Enter
```

### 发送混合内容
```
1. 输入: "😊 看我的图"
2. 点击📎上传图片
3. 等待完成后发送
```

---

## 📞 获取帮助

### 常见问题解答
参考 [TESTING_GUIDE.md](TESTING_GUIDE.md) 中的"常见问题"部分

### 查看日志
```bash
# 后端日志
tail -f /path/to/weoucbookcycle_go/logs/app.log

# 前端浏览器控制台
按 F12 打开开发者工具，查看 Console 标签
```

### 报告问题
在报告问题时，请包含：
1. 详细的错误信息
2. 操作步骤（如何重现问题）
3. 系统和浏览器信息
4. 相关的截图或日志

---

## 📈 性能基准

期望的响应时间：
- 表情加载: < 1000ms
- 图片上传 (1MB): < 3000ms  
- 消息发送: < 500ms

---

**祝你测试愉快！** 🎉

如遇问题，请参考完整文档或查看浏览器控制台错误信息。

---

**版本**: 1.0  
**最后更新**: 2024年03月  
**维护者**: Development Team
