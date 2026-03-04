// pages/wishlist/wishlist.js
const app = getApp();

Page({
  data: {
    wishlistIds: [],
    books: [],
    wishlistBooks: []
  },

  onLoad: function() {
    this.loadWishlist();
  },

  onShow: function() {
    this.loadWishlist();
  },

  loadWishlist: function() {
    const that = this;
    const wishlistIds = wx.getStorageSync('wishlist') || (app && app.globalData && app.globalData.wishlist) || [];
    that.setData({ wishlistIds });

    // fetch books from server (same as market/index) and merge local
    wx.request({
      url: app.globalData.apiBase + '/api/init',
      success: function(res) {
        let books = res.data.books || [];
        const local = wx.getStorageSync('myBooks') || [];
        if (local.length) books = local.concat(books);
        that.setData({ books });
        that.filterWishlistBooks();
      },
      fail: function() {
        let books = that.getMockBooks();
        const local = wx.getStorageSync('myBooks') || [];
        if (local.length) books = local.concat(books);
        that.setData({ books });
        that.filterWishlistBooks();
      }
    });
  },

  filterWishlistBooks: function() {
    const { books, wishlistIds } = this.data;
    const wishlistBooks = books.filter(b => wishlistIds.indexOf(b.id) > -1);
    this.setData({ wishlistBooks });
  },

  getMockBooks: function() {
    return [
      {
        id: '1',
        title: 'The Great Gatsby (Hardcover)',
        author: 'F. Scott Fitzgerald',
        cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop',
        price: 25,
        condition: '98% New',
        category: 'Literature'
      }
    ];
  },

  onBookClick: function(e) {
    const bookId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/bookdetail/bookdetail?id=' + bookId });
  },

  onToggleWishlist: function(e) {
    const bookId = e.currentTarget.dataset.id;
    let wishlist = wx.getStorageSync('wishlist') || (app && app.globalData && app.globalData.wishlist) || [];
    const index = wishlist.indexOf(bookId);
    if (index > -1) wishlist = wishlist.filter(id => id !== bookId);
    else wishlist = [...wishlist, bookId];
    wx.setStorageSync('wishlist', wishlist);
    if (app && app.globalData) app.globalData.wishlist = wishlist;
    this.setData({ wishlistIds: wishlist });
    this.filterWishlistBooks();
  }
});