/**
 * @file config/index.js
 * @description Application configuration.
 * Can be used to toggle features, configure API endpoints, etc.
 */

const env = wx.getAccountInfoSync().miniProgram.envVersion;

const config = {
  // Environment: 'develop', 'trial', 'release'
  env: env,
  
  // API Configuration
  apiBase: env === 'release' 
    ? 'https://api.weoucbookcycle.com' 
    : 'http://localhost:8080',
    
  // Mock Configuration
  // Set to true to force use mock data even if API is available
  useMock: false, 
  
  // Feature Flags
  features: {
    enableCloud: false, // Legacy cloud functions support
    enableWebSocket: true
  }
};

module.exports = config;
