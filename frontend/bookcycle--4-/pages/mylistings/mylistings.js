// pages/mylistings/mylistings.js
const app = getApp();

Page({
  data: {
    books: [],
    searchQuery: ''
  },

  onLoad: function() {
    this.loadBooks();
  },

  onShow: function() {
    this.loadBooks();
  },

  loadBooks: function() {
    const local = wx.getStorageSync('myBooks') || [];
    this.setData({ books: local });
  },

  onSearchInput: function(e) {
    const query = e.detail.value;
    this.setData({ searchQuery: query });
    this.filterBooks();
  },

  filterBooks: function() {
    const { books, searchQuery } = this.data;
    if (!searchQuery) {
      this.setData({ books: books });
      return;
    }
    const filtered = books.filter(b => {
      return b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
             b.author.toLowerCase().includes(searchQuery.toLowerCase());
    });
    this.setData({ books: filtered });
  },

  onBookClick: function(e) {
    const bookId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/bookdetail/bookdetail?id=' + bookId });
  },

  onToggleWishlist: function(e) {
    const bookId = e.currentTarget.dataset.id;
    let wishlist = wx.getStorageSync('wishlist') || [];
    const index = wishlist.indexOf(bookId);
    if (index > -1) wishlist = wishlist.filter(id => id !== bookId);
    else wishlist = [...wishlist, bookId];
    wx.setStorageSync('wishlist', wishlist);
    const app = getApp(); if (app && app.globalData) app.globalData.wishlist = wishlist;
  },

  onDeleteListing: function(e) {
    const bookId = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: 'Delete listing',
      content: 'Are you sure you want to remove this book?',
      success(res) {
        if (res.confirm) {
          let myBooks = wx.getStorageSync('myBooks') || [];
          myBooks = myBooks.filter(b => b.id !== bookId);
          wx.setStorageSync('myBooks', myBooks);
          that.setData({ books: myBooks });
        }
      }
    });
  }
});