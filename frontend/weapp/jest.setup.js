// jest.setup.js
// Mock WeChat mini program global variables
global.wx = {
  getSystemInfoSync: jest.fn(() => ({
    screenWidth: 375,
    screenHeight: 667,
    pixelRatio: 2,
  })),
  getAccountInfoSync: jest.fn(() => ({
    miniProgram: { envVersion: 'develop' }
  })),
  request: jest.fn(),
  showToast: jest.fn(),
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
  clearStorageSync: jest.fn(),
  login: jest.fn(),
  connectSocket: jest.fn(),
};

global.getApp = jest.fn(() => ({
  globalData: {
    userInfo: null,
    token: null,
    apiBase: 'http://localhost:8080',
    wsUrl: null
  }
}));

global.Page = (config) => {
    // If config has data, it should be a plain object, not a function in Page
    return config;
};
global.App = (config) => config;
global.Component = (config) => config;

// Fix miniprogram-simulate environment issue
const simulate = require('miniprogram-simulate');
if (!global.window) {
    global.window = window;
}
if (!global.document) {
    global.document = document;
}
