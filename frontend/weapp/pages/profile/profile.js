// pages/profile/profile.js
const app = getApp();
const storage = require('../../utils/storage');

Page({
  data: {
    isLoggedIn: false,
    user: {
      username: 'Guest',
      avatar: '',
      trust_score: 0
    }
  },

  onLoad: function() {
    this.loadUserData();
  },

  onShow: function() {
    this.loadUserData();
  },

  loadUserData: function() {
    if (app.globalData.userInfo) {
      const user = app.globalData.userInfo;
      // Check for admin role
      const isAdmin = user.role === 'admin' || (user.roles && user.roles.includes('admin'));
      
      this.setData({
        isLoggedIn: true,
        user: {
            ...user,
            isAdmin: isAdmin
        }
      });
    } else {
      this.setData({
        isLoggedIn: false,
        user: {
          username: 'Guest',
          avatar: '', // Default avatar placeholder
          trust_score: 0
        }
      });
    }
  },

  onLoginTap: function() {
    // 推荐使用wx.getUserProfile获取用户信息
    wx.getUserProfile({
      desc: '用于完善会员资料', // 声明获取用户个人信息后的用途，后续会展示在弹窗中
      success: (res) => {
        app.login(res.userInfo, (user) => {
          this.setData({
            isLoggedIn: true,
            user: user
          });
          wx.showToast({
            title: '登录成功',
            icon: 'success'
          });
        });
      },
      fail: (err) => {
        console.error(err);
        wx.showToast({
            title: '需要授权才能登录',
            icon: 'none'
        });
      }
    });
  },

  onLogoutTap: function() {
    app.globalData.userInfo = null;
    app.globalData.token = null;
    storage.remove('userInfo');
    storage.remove('token');
    this.setData({
        isLoggedIn: false,
        user: { username: 'Guest', avatar: '', trust_score: 0 }
    });
  },

  onMyListings: function() {
    if (!this.data.isLoggedIn) return this.onLoginTap();
    wx.navigateTo({
      url: '/pages/mylistings/mylistings'
    });
  },

  onWishlist: function() {
    if (!this.data.isLoggedIn) return this.onLoginTap();
    wx.navigateTo({
      url: '/pages/wishlist/wishlist'
    });
  }
});
