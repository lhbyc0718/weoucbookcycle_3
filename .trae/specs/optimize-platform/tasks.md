# Tasks

## Backend (Go)

- [x] Task 1: P1 - Security & Configuration
  - [x] SubTask 1.1: Implement strict file upload verification (Magic Number check) in `utils/uploader.go`.
  - [x] SubTask 1.2: Verify and tune Database Connection Pool settings in `config/database.go`.
  - [x] SubTask 1.3: Verify Graceful Shutdown logic in `main.go` (ensure all resources close).
  - [x] SubTask 1.4: Add Gzip compression middleware in `middleware/gzip.go` and register in `setupRouter`.

- [x] Task 2: P1 - Error Handling & Monitoring
  - [x] SubTask 2.1: Standardize API error responses (Code, Message) in all controllers.
  - [x] SubTask 2.2: Integrate Zap logger for structured logging in `middleware/logger.go`.
  - [x] SubTask 2.3: Add Prometheus metrics endpoint (`/metrics`) for monitoring.

- [x] Task 3: P2 - WebSocket & Concurrency
  - [x] SubTask 3.1: Optimize WebSocket heartbeat to 30s in `websocket/client.go`.
  - [x] SubTask 3.2: Review and enhance Concurrency usage (Worker Pools for async tasks) in Controllers (like `BookController`).

## Frontend (Web)

- [x] Task 4: P1 - UI/UX Improvements
  - [x] SubTask 4.1: Implement infinite scroll/pagination in `Market.tsx` and `Messages.tsx`.
  - [x] SubTask 4.2: Enhance global error handling in `api.ts` (Toast notifications).
  - [x] SubTask 4.3: Implement WebSocket auto-reconnection logic.

## Frontend (WeApp)

- [x] Task 5: P1 - Mini Program Experience
  - [x] SubTask 5.1: Implement `onReachBottom` pagination in `market.js`.
  - [x] SubTask 5.2: Add WebSocket reconnection logic in `app.js` or dedicated service.
  - [x] SubTask 5.3: Enhance error feedback (wx.showToast).
