# Checklist

## Backend
- [x] File upload rejects non-image files (based on magic numbers)
- [x] Database connection pool is configured (MaxOpen, MaxIdle)
- [x] Server shuts down gracefully on SIGTERM (logs "Server exiting")
- [x] Gzip compression is enabled for API responses
- [x] WebSocket heartbeat is 30s
- [x] API returns standardized error JSON `{code, message, data}`
- [x] Prometheus metrics are available at `/metrics` (or configured)

## Frontend (Web)
- [x] Market page supports pagination (Infinite scroll or Load More)
- [x] Network errors trigger UI notifications
- [x] WebSocket automatically reconnects after network interruption

## Frontend (WeApp)
- [x] Market list supports pull-to-refresh and reach-bottom loading
- [x] WebSocket automatically reconnects
