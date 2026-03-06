// app.js - WeOUCBC 微信小程序
import websocketService from './services/websocket.js';

App({
  onLaunch: function () {
    // 移除云开发初始化，统一使用自有服务器
    
    // 检查登录状态
    this.checkLoginStatus();

    // 初始化 WebSocket
    const wsUrl = this.globalData.apiBase.replace('http', 'ws') + '/ws';
    websocketService.init(wsUrl);
  },

  checkLoginStatus: function() {
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    if (userInfo && token) {
      this.globalData.userInfo = userInfo;
      this.globalData.token = token;
    }
  },

  login: function(userInfo, callback) {
    const that = this;
    wx.login({
      success: res => {
        if (res.code) {
          // 发送 res.code 到后台换取 openId, sessionKey, unionId
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
                wx.setStorageSync('token', token);
                wx.setStorageSync('userInfo', user);
                if (callback) callback(user);
              } else {
                wx.showToast({
                  title: '登录失败: ' + response.data.message,
                  icon: 'none'
                });
              }
            },
            fail: function(err) {
              wx.showToast({
                title: '网络错误',
                icon: 'none'
              });
            }
          })
        } else {
          console.log('登录失败！' + res.errMsg)
        }
      }
    })
  },
  
  globalData: {
    userInfo: null,
    token: null,
    apiBase: 'http://localhost:8080'
  }
});
