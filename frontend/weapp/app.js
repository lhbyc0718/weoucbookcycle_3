// app.js - WeOUCBC 微信小程序
App({
  onLaunch: function () {
    // 云开发初始化
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        // 云开发环境ID - WeOUCBC生产环境
        env: 'cloudbase-2gswhsg1728d0f01',
        traceUser: true,
      });
    }
    
    // 检查登录状态
    this.checkLoginStatus();

    // 初始化 apiBase。优先从扩展配置（云或打包时注入）读取，其次尝试向服务器请求配置
    const ext = wx.getExtConfigSync ? wx.getExtConfigSync() : {};
    if (ext && ext.apiBase) {
      this.globalData.apiBase = ext.apiBase;
    } else {
      // 异步请求后端配置，用于在部署时自动获取 apiBase
      wx.request({
        url: this.globalData.apiBase + '/api/config',
        method: 'GET',
        success: (res) => {
          if (res && res.data && res.data.apiBase) {
            this.globalData.apiBase = res.data.apiBase;
          }
        },
        fail: () => {
          // 请求失败则保持默认
        },
      });
      if (process && process.env && process.env.API_BASE) {
        this.globalData.apiBase = process.env.API_BASE;
      }
    }
  },

  
  checkLoginStatus: function() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
    }
  },
  
  globalData: {
    userInfo: null,
    // API基础地址（如果使用自有服务器）
    apiBase: 'https://your-server.com'
  }
});
