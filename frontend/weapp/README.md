# WeChat Mini Program Frontend

This folder holds the WeChat Mini Program source for the BookCycle project. It
uses the same backend API as the web client; `app.globalData.apiBase` should be
configured to point at the Go server (default value is `https://your-server.com`).

### Structure

- `app.js`, `app.json`, `app.wxss` – entrypoint and global configuration
- `pages/` – page components in WXML/JS/CSS
- `cloudfunctions/` – optional cloud code used by some features

### Configuration

You may supply the API base URL via one of the following methods:

1. Set `ext.json` or `app.json` with a field `apiBase` (accessible via
   `wx.getExtConfigSync()`)
2. Store it in `wx.setStorageSync('apiBase', 'https://your-server.com')` before
   making requests

By default the code falls back to the hard‑coded placeholder.

### Running

Open this folder (`frontend/weapp`) in the WeChat Developer Tools. Cloud development
and database collections (`messages`, `chats`) should be created as described in
original documentation.
