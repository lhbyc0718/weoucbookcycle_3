# Backend (Go)

This is the Go server for the BookCycle project. It exposes a REST API that is
used by both the web frontend and the WeChat Mini Program. The server supports
optional Redis, object storage, and WebSocket chat.

## Configuration

Copy `.env.example` to `.env` and fill in values. Important variables include:

- `SERVER_PORT`, `GIN_MODE` – HTTP server settings
- Database credentials (`DB_HOST`, `DB_USER`, etc.) or `DB_DSN`
- `JWT_SECRET` – must be a secure random string in production
- `REDIS_ENABLED`, `REDIS_ADDR`, etc. – optional caching/locking

### Object Storage (optional)

To store user-uploaded files (images, etc.) in an external object storage
service compatible with the S3 API, set the following environment variables
before starting the server:

```dotenv
STORAGE_PROVIDER=s3              # required to enable storage
STORAGE_ENDPOINT=s3.amazonaws.com # or your MinIO/OSS endpoint
STORAGE_ACCESS_KEY=<access key>
STORAGE_SECRET_KEY=<secret key>
STORAGE_BUCKET=<bucket-name>
STORAGE_REGION=<optional region>
STORAGE_USE_SSL=true
# Optional public base URL (if you front with CDN or custom domain)
STORAGE_PUBLIC_URL=https://cdn.example.com
```

When configured, uploaded files will be sent directly to the storage bucket and
`UploadResult.OriginalURL` will contain the full externally accessible URL. If
storage is **not** configured, uploads fall back to the local `./uploads`
directory and are served by the application at `/uploads/*`.

Example usage in a controller:

```go
func (ctrl *SomeController) UploadPhoto(c *gin.Context) {
    uploader := utils.NewFileUploader()
    result, err := uploader.UploadFile(c, "photo")
    if err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    c.JSON(200, result)
}
```

The generated `result.OriginalURL` can then be stored in the database and
returned to clients.

## Running

```sh
cd backend/weoucbookcycle_go
go run main.go
```

For production build:

```sh
go build -o bin/server ./...
```

The server performs automatic database migrations when `ENABLE_AUTO_MIGRATE`
is set to `true` (default in non‑release modes).

## Notes

- CORS origins can be controlled via `ALLOW_ORIGINS` (comma separated).
- Use `API_BASE` to tell frontends where the backend is hosted (used in
  `/api/config` response).
- `SERVE_WEB` can be enabled to serve static web client files directly.
