<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/59917f12-cbb4-4f46-af7c-ee5efc229976

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## 微信云开发配置

- 在 `app.json` 中已设置 `appid`，值为 `wxceb369d32ab102d5`。
- 在 `app.js` 中已将云环境 ID 设置为 `cloudbase-2gswhsg1728d0f01`（请确认这是你的目标环境）。
- 本项目原先使用 `wx.getLocation` 获取用户位置，但该接口已被移除，相关调用与权限声明已清理。
- 在微信开发者工具中打开项目后，确保在“云开发”面板中启用该环境，并在数据库中创建集合 `messages` 和 `chats` 以支持即时通信功能。
