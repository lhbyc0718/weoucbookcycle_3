# BookCycle WeChat Mini Program

This directory contains the source code for the BookCycle WeChat Mini Program (frontend/weapp). It connects to the BookCycle Go backend to provide a marketplace for students to buy and sell used books.

## Directory Structure

```
frontend/weapp/
├── components/         # Reusable UI components (if any)
├── cloudfunctions/     # WeChat Cloud Functions (e.g., login, books)
├── pages/              # Mini Program pages
│   ├── index/          # Home page
│   ├── bookdetail/     # Book details page
│   ├── market/         # Marketplace listing
│   ├── post/           # Create new listing
│   ├── messages/       # Chat list
│   ├── chatdetail/     # Chat interface
│   └── ...
├── services/           # Business logic and API services (e.g., websocket.js)
├── utils/              # Utility functions (date formatting, storage helper)
├── app.js              # Global app logic (lifecycle, global data)
├── app.json            # Global configuration (pages, window, tabbar)
├── app.wxss            # Global styles
└── project.config.json # Project configuration for WeChat DevTools
```

## Prerequisites

- **Node.js**: Required for installing development dependencies (linting, testing).
- **WeChat Developer Tools**: Required to run and debug the Mini Program.
- **WeChat AppID**: You need a valid AppID to run the project on a device.

## Setup & Installation

1.  **Install Dependencies**:
    Navigate to this directory and run:
    ```bash
    npm install
    ```
    This installs tools for linting (ESLint), formatting (Prettier), and testing (Jest).

2.  **Open in WeChat DevTools**:
    -   Open WeChat Developer Tools.
    -   Click "Import Project".
    -   Select the `frontend/weapp` directory.
    -   Enter your AppID (or use a test ID).

3.  **Build npm**:
    -   In WeChat DevTools, go to `Tools` -> `Build npm`.
    -   This is required if you use any npm packages in the runtime code.

## Configuration

### API Configuration
The API base URL is configured in `app.js`.
By default, it tries to detect the environment:
-   **Release**: Production URL (configure in `app.js`)
-   **Develop/Trial**: Localhost or Development URL

To manually set the API URL, modify `app.js`:
```javascript
globalData: {
  apiBase: 'http://localhost:8080', // Change this to your backend URL
  // ...
}
```

### Cloud Development
This project uses WeChat Cloud Development for some features (or legacy features).
1.  Click "Cloud" button in DevTools to open Cloud Console.
2.  Initialize the environment.
3.  Right-click `cloudfunctions` folder and select your environment.
4.  Right-click each cloud function (e.g., `login`) and select "Upload and Deploy: Cloud Install Dependencies".

## Development

### Scripts
-   **Lint Code**: `npm run lint`
-   **Fix Lint Errors**: `npm run lint:fix`
-   **Format Code**: `npm run format`
-   **Run Tests**: `npm test`

### Mock Data
Mock data is useful when the backend API is not available or for testing purposes.

**Configuration:**
Modify `config/index.js` to enable or disable mock mode:
```javascript
const config = {
  // ...
  useMock: true, // Set to true to force use mock data
  // ...
};
```

**Mock Data Location:**
- Mock data files are located in `mock/` directory.
- Example: `mock/books.js` contains mock data for books.

**Usage:**
- `app.js` checks `config.useMock` during login.
- `pages/bookdetail/bookdetail.js` checks `config.useMock` to load book details.

## Testing

We use **Jest** and **miniprogram-simulate** for testing.

### Running Tests
```bash
npm test
```

### Writing Tests
-   Place test files in `__tests__` directories or name them `*.test.js`.
-   Use `miniprogram-simulate` to render components/pages in a simulated environment.
-   Example: `tests/utils.test.js`

## Deployment

1.  **Code Quality Check**: Run `npm run lint` and `npm test` to ensure code quality.
2.  **Upload**:
    -   In WeChat DevTools, click "Upload".
    -   Enter version number and description.
3.  **Release**:
    -   Go to WeChat Official Accounts Platform (mp.weixin.qq.com).
    -   Go to "Version Management".
    -   Submit the uploaded version for audit.
    -   Once approved, release it.

## API Documentation
The backend API documentation is available via Swagger (if generated).
Refer to `backend/README.md` for details on generating and accessing API docs.
Common endpoints:
-   `GET /api/books`: List books
-   `GET /api/books/:id`: Get book details
-   `POST /api/auth/wechat`: WeChat Login
