/**
 * app.js - WeOUC BookCycle 微信小程序
 * 
 * 统一使用自建Go后端，不依赖微信云开发
 */

App({
  onLaunch: function () {
    console.log('[App] 应用启动');
    
    // 初始化全局数据
    this.initGlobalData();
    
    // 检查登录状态
    this.checkLoginStatus();
  },

  /**
   * 初始化全局数据
   */
  initGlobalData: function() {
    try {
      const appConfig = require('./app.json');
      if (appConfig && appConfig.config) {
        this.globalData.apiBase = appConfig.config.apiBase || 'http://localhost:8080';
        this.globalData.apiEnv = appConfig.config.apiEnv || 'development';
      }
    } catch (e) {
      console.warn('[App] 无法读取app.json配置:', e);
      this.globalData.apiBase = 'http://localhost:8080';
      this.globalData.apiEnv = 'development';
    }
    
    console.log('[App] API Base:', this.globalData.apiBase);
    console.log('[App] API Environment:', this.globalData.apiEnv);
  },

  /**
   * 检查登录状态
   * 如果已登录且token未过期，直接返回
   * 否则启动微信登录流程
   */
  checkLoginStatus: function() {
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('authToken');
    const tokenExpiry = wx.getStorageSync('tokenExpiry');

    if (userInfo && token) {
      // 检查token是否已过期
      const now = Math.floor(Date.now() / 1000);
      if (tokenExpiry && now < tokenExpiry) {
        // Token仍然有效
        this.globalData.userInfo = userInfo;
        this.globalData.authToken = token;
        console.log('[App] 使用本地token登录成功');
        return;
      }
      // Token已过期，清除并重新登录
      console.log('[App] Token已过期，需要重新登录');
      wx.removeStorageSync('authToken');
      wx.removeStorageSync('tokenExpiry');
    }

    // 执行微信登录
    this.doWeChatLogin();
  },

  /**
   * 执行微信登录流程
   * 
   * 流程：
   * 1. 调用wx.login获取临时登录凭证(code)
   * 2. 将code发送到后端/api/auth/wechat
   * 3. 后端验证code，返回token和用户信息
   * 4. 保存token和用户信息到本地存储
   */
  doWeChatLogin: function() {
    const that = this;
    const apiBase = this.globalData.apiBase;

    wx.login({
      success: function(loginRes) {
        if (!loginRes.code) {
          console.error('[Login] 获取登录凭证失败');
          wx.showModal({
            title: '登录失败',
            content: '获取登录凭证失败，请重试',
            showCancel: false,
            confirmText: '重试',
            success: function(res) {
              if (res.confirm) {
                that.doWeChatLogin();
              }
            }
          });
          return;
        }

        console.log('[Login] 获取到登录code，发送到后端...');

        // 发送code到后端
        wx.request({
          url: apiBase + '/api/auth/wechat',
          method: 'POST',
          data: {
            code: loginRes.code
          },
          header: {
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          success: function(apiRes) {
            const response = apiRes.data;
            
            if (apiRes.statusCode !== 200) {
              console.error('[Login] 服务器返回错误:', apiRes.statusCode);
              wx.showModal({
                title: '登录失败',
                content: '服务器错误，请稍后重试',
                showCancel: false,
                confirmText: '重试',
                success: function(res) {
                  if (res.confirm) {
                    that.doWeChatLogin();
                  }
                }
              });
              return;
            }

            if (response.code === 20000 && response.data && response.data.token) {
              // 登录成功，保存信息
              const userInfo = {
                id: response.data.user.id,
                username: response.data.user.username,
                email: response.data.user.email || '',
                avatar: response.data.user.avatar || '',
              };

              const token = response.data.token;
              const expiresIn = response.data.expiresIn || 7200; // 默认2小时
              const tokenExpiry = Math.floor(Date.now() / 1000) + expiresIn;

              // 保存到本地存储
              wx.setStorageSync('userInfo', userInfo);
              wx.setStorageSync('authToken', token);
              wx.setStorageSync('tokenExpiry', tokenExpiry);

              // 更新全局数据
              that.globalData.userInfo = userInfo;
              that.globalData.authToken = token;

              console.log('[Login] 登录成功:', userInfo.username);
            } else {
              console.error('[Login] 后端返回错误:', response.message);
              wx.showModal({
                title: '登录失败',
                content: response.message || '登录失败，请稍后重试',
                showCancel: false,
                confirmText: '重试',
                success: function(res) {
                  if (res.confirm) {
                    that.doWeChatLogin();
                  }
                }
              });
            }
          },
          fail: function(err) {
            console.error('[Login] 网络请求失败:', err);
            wx.showModal({
              title: '登录失败',
              content: '网络连接失败，请检查网络后重试',
              showCancel: false,
              confirmText: '重试',
              success: function(res) {
                if (res.confirm) {
                  that.doWeChatLogin();
                }
              }
            });
          }
        });
      },
      fail: function(err) {
        console.error('[Login] 微信登录授权失败:', err);
        wx.showModal({
          title: '授权失败',
          content: '请授予微信登录权限以继续',
          showCancel: false,
          confirmText: '重试',
          success: function(res) {
            if (res.confirm) {
              that.doWeChatLogin();
            }
          }
        });
      }
    });
  },

  globalData: {
    userInfo: null,        // 当前用户信息
    authToken: null,       // JWT token
    apiBase: 'http://localhost:8080',  // API基础地址
    apiEnv: 'development'  // API环境: development/test/production
  }
});

    // Step 1: 调用 wx.login 获取临时登录凭证
    wx.login({
      success: function(res) {
        if (res.code) {
          // Step 2: 将 code 发送到后端交换 openid 和 token
          wx.request({
            url: apiBase + '/api/auth/wechat',
            method: 'POST',
            data: {
              code: res.code
            },
            success: function(apiRes) {
              const response = apiRes.data;
              if (response.code === 20000 && response.data && response.data.token) {
                // Step 3: 保存不可推你的 token 和用户信息
                const userInfo = {
                  id: response.data.user.id,
                  username: response.data.user.username,
                  avatar: response.data.user.avatar || '',
                };
                wx.setStorageSync('userInfo', userInfo);
                wx.setStorageSync('authToken', response.data.token);

                // Step 4: 推新上下文
                that.globalData.userInfo = userInfo;
                that.globalData.authToken = response.data.token;
              } else {
                wx.showModal({
                  title: '登录失败',
                  content: response.message || '服务器繁忙，请稍后重试',
                  showCancel: false
                });
              }
            },
            fail: function() {
              // 后端调用失败，会辛配下次开启程序时重试
              console.error('微信登录失败（技术错误）');
            }
          });
        } else {
          console.error('获取登录凭证失败');
        }
      },
      fail: function() {
        wx.showModal({
          title: '登录失败',
          content: '请给予微信登录授权',
          showCancel: false
        });
      }
    });
  },
  
  globalData: {
    userInfo: null,
    authToken: null,
    useCloud: (function() {
      try {
        const appConfig = require('./app.json');
        return appConfig && appConfig.config && appConfig.config.useCloud;
      } catch (e) {
        return false;
      }
    })(),
    // 使用小程序内置配置（app.json -> config.apiBase）优先，其次使用本地默认
    apiBase: (function() {
      try {
        const appConfig = require('./app.json');
        if (appConfig && appConfig.config && appConfig.config.apiBase) return appConfig.config.apiBase;
      } catch (e) {
        // ignore
      }
      return 'https://api.example.com';
    })()
  }
});