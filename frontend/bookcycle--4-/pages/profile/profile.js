// pages/profile/profile.js
const app = getApp();

Page({
  data: {
    user: {
      id: '',
      name: '',
      avatar: '',
      rank: '',
      ratingCount: 0,
      sales: 0,
      trustScore: 0
    }
  },

  onLoad: function() {
    this.loadUserData();
  },

  onShow: function() {
    // 每次显示时刷新用户数据
    this.loadUserData();
  },

  loadUserData: function() {
    const that = this;
    const localUser = wx.getStorageSync('userInfo');

    // default profile values
    const defaultUser = {
      id: 'me',
      name: 'BookLover_99',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
      rank: 'Gold Trader',
      ratingCount: 12,
      sales: 42,
      trustScore: 100
    };

    // if we have a logged in user, try to fetch cloud record
    if (that.globalData && that.globalData.userInfo && that.globalData.userInfo.id) {
      wx.cloud.database().collection('users')
        .doc(that.globalData.userInfo.id)
        .get()
        .then(res => {
          const cloudUser = res.data || {};
          const merged = { ...defaultUser, ...cloudUser };
          that.setData({ user: merged });
          wx.setStorageSync('userInfo', merged);
        })
        .catch(() => {
          // failed to fetch cloud user, fall back to local
          if (localUser) {
            that.setData({ user: { ...defaultUser, ...localUser } });
          } else {
            that.setData({ user: defaultUser });
          }
        });
    } else {
      // no login yet, fallback to local storage or default
      if (localUser) {
        that.setData({ user: { ...defaultUser, ...localUser } });
      } else {
        that.setData({ user: defaultUser });
      }
    }
  },

  onMyListings: function() {
    wx.navigateTo({
      url: '/pages/mylistings/mylistings'
    });
  },

  onWishlist: function() {
    // Navigate to wishlist page which shows saved books
    wx.navigateTo({
      url: '/pages/wishlist/wishlist'
    });
  },

  onAvatarTap: function() {
    const that = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        const tempPath = res.tempFilePaths[0];
        // update data & storage
        const updatedUser = { ...that.data.user, avatar: tempPath };
        that.setData({ user: updatedUser });
        wx.setStorageSync('userInfo', updatedUser);

        // also update cloud record if logged in
        if (that.globalData && that.globalData.userInfo && that.globalData.userInfo.id) {
          wx.cloud.database().collection('users')
            .doc(that.globalData.userInfo.id)
            .update({ data: { avatar: tempPath } })
            .catch(() => {
              // ignore failure, local state still updated
            });
        }

        wx.showToast({
          title: '头像已更新',
          icon: 'success',
          duration: 1500
        });
      },
      fail() {
        wx.showToast({ title: '更新失败', icon: 'none' });
      }
    });
  }
});
