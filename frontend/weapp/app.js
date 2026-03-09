/**
 * @file app.js
 * @description Global application logic for the BookCycle Mini Program.
 * Handles lifecycle events, global data, and user authentication.
 */
import websocketService from './services/websocket.js';
const storage = require('./utils/storage');
const config = require('./config/index');

App({
  /**
   * Lifecycle function--Called when the mini program is launched.
   */
  onLaunch: function () {
    // Remove cloud development initialization, use own server
    
    // Check login status
    this.checkLoginStatus();

    // Initialize WebSocket URL, but do not connect immediately, wait for checkLoginStatus to get token
    // Or connect after successful login
    const wsProtocol = this.globalData.apiBase.startsWith('https') ? 'wss' : 'ws';
    const wsUrl = this.globalData.apiBase.replace(/^http(s)?:\/\//, wsProtocol + '://') + '/ws';
    
    if (this.globalData.token) {
        websocketService.init(wsUrl);
    } else {
        // Save URL for use after login
        this.globalData.wsUrl = wsUrl;
    }
  },

  /**
   * Checks local storage for existing login session.
   * Updates globalData with userInfo and token if found.
   */
  checkLoginStatus: function() {
    const userInfo = storage.get('userInfo');
    const token = storage.get('token');
    if (userInfo && token) {
      this.globalData.userInfo = userInfo;
      this.globalData.token = token;
    }
  },

  /**
   * Performs WeChat login and authenticates with the backend.
   * @param {Object} userInfo - User information from WeChat (avatar, nickname).
   * @param {Function} [callback] - Optional callback function to execute after successful login.
   */
  login: function(userInfo, callback) {
    const that = this;
    
    // Check if using mock
    if (config.useMock) {
        console.log('Mock login');
        const mockUser = { id: 'mock_user', name: 'Mock User', avatar: '' };
        const mockToken = 'mock_token';
        that.globalData.token = mockToken;
        that.globalData.userInfo = mockUser;
        storage.set('token', mockToken);
        storage.set('userInfo', mockUser);
        if (callback) callback(mockUser);
        return;
    }

    wx.login({
      success: res => {
        if (res.code) {
          // Send res.code to backend to exchange for openId, sessionKey, unionId
          wx.request({
            url: that.globalData.apiBase + '/api/auth/wechat',
            method: 'POST',
            data: {
              code: res.code,
              avatar: userInfo.avatarUrl,
              nickname: userInfo.nickName
            },
            success: function(response) {
              if (response.data.code === 20000) {
                const { token, user } = response.data.data;
                that.globalData.token = token;
                that.globalData.userInfo = user;
                storage.set('token', token);
                storage.set('userInfo', user);
                
                // Connect WebSocket after successful login
                if (that.globalData.wsUrl) {
                    websocketService.init(that.globalData.wsUrl);
                } else {
                    const wsProtocol = that.globalData.apiBase.startsWith('https') ? 'wss' : 'ws';
                    const wsUrl = that.globalData.apiBase.replace(/^http(s)?:\/\//, wsProtocol + '://') + '/ws';
                    websocketService.init(wsUrl);
                }

                if (callback) callback(user);
              } else {
                wx.showToast({
                  title: 'Login failed: ' + response.data.message,
                  icon: 'none'
                });
              }
            },
            fail: function() {
              wx.showToast({
                title: 'Network error',
                icon: 'none'
              });
            }
          })
        } else {
          console.error('Login failed! ' + res.errMsg);
        }
      }
    })
  },
  
  globalData: {
    userInfo: null,
    token: null,
    config: config, // Expose config globally
    apiBase: config.apiBase,
    wsUrl: null
  }
});
