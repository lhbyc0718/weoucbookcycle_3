# BookCycle Web 前端

现代 React + TypeScript + Vite 前端应用，与 BookCycle Go 后端无缝集成。

## 📋 功能

- 🏠 **首页** - 精选图书展示和快速操作
- 📚 **市场** - 图书搜索和分类筛选
- 📖 **图书详情** - 完整图书信息和卖家联系
- 💬 **消息** - 聊天记录管理
- 💌 **聊天** - 实时消息交互
- 👤 **个人资料** - 用户信息管理
- ➕ **发布** - 上架新图书

## 🚀 快速开始

### 前置要求
- Node.js 16+ 
- npm 或 yarn
- 后端服务运行在 `http://localhost:8080`

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

开发服务器将在 [http://localhost:3000](http://localhost:3000) 启动，支持自动刷新和热更新。

### 构建生产版本
```bash
npm run build
```

生产文件将输出到 `dist/` 目录。

### 预览生产构建
```bash
npm run preview
```

## 📁 项目结构

```
web/
├── src/
│   ├── services/
│   │   └── api.ts           # Axios 客户端配置和 API 模块
│   ├── pages/               # 页面组件
│   │   ├── Home.tsx
│   │   ├── Market.tsx
│   │   ├── BookDetail.tsx
│   │   ├── Messages.tsx
│   │   ├── ChatDetail.tsx
│   │   ├── UserProfile.tsx
│   │   └── Post.tsx
│   ├── styles/
│   │   └── pages.css        # 响应式样式表
│   ├── App.tsx              # 主应用和 SPA 路由
│   ├── App.css              # 头部和导航样式
│   └── main.tsx             # 应用入口
├── index.html               # HTML 模板
├── vite.config.ts           # Vite 配置
├── tsconfig.json            # TypeScript 配置
└── package.json             # 项目依赖
```

## 🔧 配置

### 后端 API 地址

在 `src/services/api.ts` 中配置 API 基础 URL：

```typescript
const API_BASE = process.env.VITE_API_BASE || 'http://localhost:8080';
```

可以通过 `.env` 文件覆盖：

```
VITE_API_BASE=http://localhost:8080
```

## 🔐 身份验证

- 登录后的 token 存储在 `localStorage` 中，key 为 `authToken`
- 请求会自动在 `Authorization: Bearer <token>` 头中包含 token
- 如果返回 401，会自动调用 `/api/auth/refresh` 刷新 token 并重试请求

## 📡 API 集成

应用与后端 API 集成，支持以下模块：

- `authApi` - 认证服务
- `bookApi` - 图书服务
- `userApi` - 用户服务
- `chatApi` - 聊天服务
- `listingApi` - 列表服务
- `searchApi` - 搜索服务

所有 API 调用都会自动处理 token 注入和错误响应。

## 📦 依赖

- **React 18.2** - UI 框架
- **TypeScript** - 类型安全
- **Axios** - HTTP 客户端
- **Vite** - 构建和开发服务器

## 🛠️ 开发

项目支持 TypeScript 和 JSX。所有组件使用 React 函数组件和 Hooks。

样式采用 CSS Grid 和 Flexbox 实现响应式布局，支持移动设备。

## ⚙️ 脚本

- `npm run dev` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm run preview` - 预览生产构建
- `npm run type-check` - 检查 TypeScript 类型

## 📝 许可证

MIT
