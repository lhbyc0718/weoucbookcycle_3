const app = getApp();

Page({
  data: {
    isWeChatLogin: true,
    identifier: '',
    password: '',
    loading: false
  },

  onLoad(options) {
    this.redirectUrl = options.redirect;
  },

  toggleLoginMode() {
    this.setData({ isWeChatLogin: !this.data.isWeChatLogin });
  },

  onInputIdentifier(e) {
    this.setData({ identifier: e.detail.value });
  },

  onInputPassword(e) {
    this.setData({ password: e.detail.value });
  },

  handlePasswordLogin() {
    const { identifier, password } = this.data;
    if (!identifier || !password) {
      wx.showToast({ title: '请填写账号密码', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    wx.request({
      url: app.globalData.apiBase + '/api/auth/login',
      method: 'POST',
      data: { identifier, password },
      success: (res) => {
        if (res.data.code === 20000) {
          const { token, user } = res.data.data;
          app.globalData.token = token;
          app.globalData.userInfo = user;
          wx.setStorageSync('token', token);
          wx.setStorageSync('userInfo', user);
          
          wx.showToast({ title: '登录成功' });
          this.handleSuccess();
        } else {
          wx.showToast({ title: res.data.message || '登录失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  handleSuccess() {
    if (this.redirectUrl) {
      if (['/pages/index/index', '/pages/market/market', '/pages/messages/messages', '/pages/profile/profile'].includes(this.redirectUrl)) {
        wx.switchTab({ url: this.redirectUrl });
      } else {
        wx.redirectTo({ url: this.redirectUrl });
      }
    } else {
      wx.navigateBack({
        fail: () => {
           wx.switchTab({ url: '/pages/index/index' });
        }
      });
    }
  },

  handleLogin() {
    wx.getUserProfile({
      desc: '用于完善会员资料', 
      success: (res) => {
        wx.showLoading({ title: '登录中...' });
        app.login(res.userInfo, (user) => {
          wx.hideLoading();
          wx.showToast({ title: '登录成功' });
          this.handleSuccess();
        });
      },
      fail: (err) => {
        console.error(err);
        wx.showToast({ title: '授权失败', icon: 'none' });
      }
    });
  },
  
  handleCancel() {
    // If we came from a tabbar page (like post or profile), going back will trigger onShow again
    // leading to a loop if those pages auto-redirect to login.
    // So safest bet is to go to home page.
    wx.switchTab({ url: '/pages/index/index' });
  }
})
