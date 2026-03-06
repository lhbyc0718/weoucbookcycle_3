# Optimize Platform Spec

## Why
To improve user experience (P1) and system performance/stability (P2) for the OUC book trading platform. The current system lacks robust error handling, security validations, and optimization for high concurrency.

## What Changes

### P1: Critical Experience Improvements
- **Pagination**: Standardize pagination across all list APIs (Books, Listings, Chats, etc.) and Frontend components.
- **Error Handling**: Implement unified error response structure and frontend error boundary/toast notifications.
- **Upload Verification**: Add strict file type (magic number) and size validation for image uploads.
- **DB Connection Pool**: Explicitly configure MySQL connection pool parameters (MaxIdle, MaxOpen, Lifetime).
- **Graceful Shutdown**: Ensure server handles SIGINT/SIGTERM correctly, closing DB/Redis/WebSocket connections gracefully.
- **Monitoring & Logging**: Integrate structured logging (Zap) and basic metrics (Prometheus endpoint).

### P2: Optimization & Concurrency
- **CDN**: Support CDN URL prefix for static assets (images).
- **WebSocket Optimization**: 
  - Reduce heartbeat interval to 30s.
  - Implement auto-reconnection on Frontend.
- **Compression**: Enable Gzip compression for API responses.
- **Concurrency**: Utilize Go routines for non-blocking operations (e.g., stats updates, async notifications) to improve throughput.

## Impact
- **Backend**: `middleware`, `config`, `controllers`, `utils`, `websocket`.
- **Frontend (Web)**: `api.ts`, list pages (`Market`, `Messages`), `WebSocket` logic.
- **Frontend (WeApp)**: `app.js`, `market.js`, `websocket` logic.

## ADDED Requirements

### Requirement: File Upload Verification
The system SHALL validate file uploads by checking magic numbers, not just extensions.
The system SHALL limit file size to 5MB.

### Requirement: Database Pool
The system SHALL configure `SetMaxOpenConns`, `SetMaxIdleConns`, and `SetConnMaxLifetime`.

### Requirement: WebSocket Resilience
The Client SHALL attempt to reconnect with exponential backoff upon disconnection.
The Server SHALL send pings every 30s.

### Requirement: Concurrency
The system SHALL use worker pools or goroutines for background tasks (e.g., updating view counts, sending emails) to avoid blocking the main request thread.
