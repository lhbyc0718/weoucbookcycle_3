// pages/post/post.js
const app = getApp();

Page({
  data: {
    title: '',
    author: '',
    price: 45,
    selectedTags: [],
    images: [],
    categories: [
      'Used Books', 
      'Textbook', 
      'Non-Textbook', 
      'New Book', 
      'QR Code for English Books',
      'Literature',
      'Science',
      'History',
      'Art'
    ],
    isRestricted: false,
    trustScore: 100
  },

  onLoad: function() {
    this.checkUserStatus();
  },

  checkUserStatus: function() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.trustScore <= 60) {
      this.setData({
        isRestricted: true,
        trustScore: userInfo.trustScore || 60
      });
    }
  },

  onBack: function() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  onTitleInput: function(e) {
    this.setData({ title: e.detail.value });
  },

  onAuthorInput: function(e) {
    this.setData({ author: e.detail.value });
  },

  onPriceChange: function(e) {
    this.setData({ price: e.detail.value });
  },

  toggleTag: function(e) {
    const tag = e.currentTarget.dataset.tag;
    if (!tag) return;
    
    let selectedTags = this.data.selectedTags || [];
    const index = selectedTags.indexOf(tag);
    
    if (index > -1) {
      // remove tag by creating new array so setData detects change
      selectedTags = selectedTags.filter(t => t !== tag);
      console.log('[post] removed tag', tag, selectedTags);
    } else {
      selectedTags = [...selectedTags, tag];
      console.log('[post] added tag', tag, selectedTags);
    }
    
    this.setData({ selectedTags });
  },

  chooseImage: function() {
    const that = this;
    wx.chooseMedia({
      count: 9 - (that.data.images ? that.data.images.length : 0),
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        if (res.tempFiles && res.tempFiles.length > 0) {
          const newImages = res.tempFiles.map(f => f.tempFilePath);
          const allImages = (that.data.images || []).concat(newImages);
          that.setData({ images: allImages });
        }
      },
      fail: function(err) {
        console.error('选择图片失败', err);
      }
    });
  },

  removeImage: function(e) {
    const index = e.currentTarget.dataset.index;
    if (index === undefined || index === null) return;
    
    const images = this.data.images || [];
    if (index >= 0 && index < images.length) {
      images.splice(index, 1);
      this.setData({ images: images });
    }
  },

  handlePublish: function() {
    const { title, author, selectedTags, price, images } = this.data;

    if (!title || !title.trim()) {
      wx.showToast({
        title: 'Please enter book title',
        icon: 'none'
      });
      return;
    }

    if (!author || !author.trim()) {
      wx.showToast({
        title: 'Please enter author name',
        icon: 'none'
      });
      return;
    }

    if (!selectedTags || selectedTags.length === 0) {
      wx.showToast({
        title: 'Please choose at least one tag/category',
        icon: 'none'
      });
      return;
    }

    const userInfo = wx.getStorageSync('userInfo') || {};
    const sellerId = userInfo.id || 'me';
    const newBook = {
      id: 'b' + Date.now(),
      title: title,
      author: author,
      cover: (images && images[0]) ? images[0] : 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop',
      price: price || 45,
      condition: 'Good',
      sellerId: sellerId,
      description: 'Newly listed book.',
      category: selectedTags[0],
      tags: selectedTags,
      location: 'Shanghai, CN',
      shippingTime: 'Ships within 24h',
      images: (images && images.length > 0) ? images : ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&h=1200&fit=crop']
    };

    // persist to cloud if available
    if (wx.cloud && wx.cloud.database) {
      const db = wx.cloud.database();
      db.collection('books').add({ data: newBook }).catch(() => {});
    }

    // Save to local storage for immediate visibility
    const books = wx.getStorageSync('myBooks') || [];
    books.push(newBook);
    wx.setStorageSync('myBooks', books);

    wx.showToast({
      title: 'Book published!',
      icon: 'success'
    });

    // Navigate to market
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/market/market'
      });
    }, 1500);
  }
});
