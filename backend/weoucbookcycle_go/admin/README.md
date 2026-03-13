Go-Admin 管理后台（最小脚手架）

说明
- 该目录包含一个最小的 go-admin 启动器，用于连接你项目的 MySQL 数据库并在 `/admin` 提供管理界面。

运行前准备
1. 在项目根目录（weoucbookcycle_go）确保已设置数据库 env：

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=weoucbookcycle
```

2. 进入本目录并获取依赖：

```bash
cd backend/weoucbookcycle_go
go get ./...
go get github.com/GoAdminGroup/go-admin
```

3. 运行 admin 服务：

```bash
# 可选环境变量：ADMIN_EMAIL, ADMIN_PASSWORD
ADMIN_EMAIL=admin@local ADMIN_PASSWORD=secret go run ./admin/main.go
```

4. 打开浏览器访问：

```
http://localhost:8081/admin
```

说明与后续工作
- 本脚手架注册了 `users`, `books`, `addresses` 三个资源的最简表格视图（使用 go-admin 的默认表格生成器）。
- 若需定制字段、表单、操作和权限，请告诉我，我会为每个资源补充 `table` 配置以满足前端需求。
- 你可以把 admin 与主项目共享相同的数据库与模型，已按环境变量连接到相同 MySQL。
- 启动时会尝试在 `users` 表中创建默认管理员（`ADMIN_EMAIL`），如未提供 `ADMIN_PASSWORD` 将自动生成并打印在控制台。
