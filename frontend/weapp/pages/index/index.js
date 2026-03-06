// pages/index/index.js
const app = getApp();

Page({
  data: {
    searchQuery: '',
    selectedCategory: null,
    wishlist: [],
    books: [],
    filteredBooks: [],
    categories: [
      { id: 'Used Books', label: 'Used', icon: '📚', color: 'orange' },
      { id: 'Textbook', label: 'Textbook', icon: '📖', color: 'blue' },
      { id: 'Non-Textbook', label: 'Non-textbook', icon: '☕', color: 'green' },
      { id: 'New Book', label: 'New', icon: '✨', color: 'purple' },
      { id: 'QR Code', label: 'QR Code', icon: '📱', color: 'slate' }
    ],
    loading: false
  },

  onLoad: function() {
    this.loadBooks();
    
    // Load wishlist from storage
    const wishlist = wx.getStorageSync('wishlist') || [];
    this.setData({ wishlist });

  },

  onShow: function() {
    // refresh booklist when the tab regains focus
    this.loadBooks();
    const wishlist = wx.getStorageSync('wishlist') || (getApp() && getApp().globalData && getApp().globalData.wishlist) || [];
    this.setData({ wishlist });
  },

  loadBooks: function() {
    const that = this;
    this.setData({ loading: true });

    // Unified data source: Self-hosted Server
    wx.request({
      url: app.globalData.apiBase + '/api/books', // Endpoint for fetching books
      method: 'GET',
      success: function(res) {
        let books = [];
        if (res.data && Array.isArray(res.data)) {
            books = res.data;
        } else if (res.data && res.data.data && Array.isArray(res.data.data)) {
            books = res.data.data;
        } else if (res.data && res.data.books && Array.isArray(res.data.books)) {
            books = res.data.books;
        }
        
        that.setData({ 
            books: books, 
            filteredBooks: books,
            loading: false
        });
      },
      fail: function(err) {
        console.error('Failed to load books:', err);
        wx.showToast({
            title: '加载失败',
            icon: 'none'
        });
        that.setData({ loading: false });
      }
    });
  },

  // Removed getMockBooks

  onSearchInput: function(e) {
    const query = e.detail.value;
    this.setData({ searchQuery: query });
    this.filterBooks();
  },

  onCategoryTap: function(e) {
    const categoryId = e.currentTarget.dataset.id;
    const currentCategory = this.data.selectedCategory;
    
    if (currentCategory === categoryId) {
      this.setData({ selectedCategory: null });
    } else {
      this.setData({ selectedCategory: categoryId });
    }
    this.filterBooks();
  },

  clearCategory: function() {
    this.setData({ selectedCategory: null });
    this.filterBooks();
  },

  filterBooks: function() {
    const { books, searchQuery, selectedCategory } = this.data;
    
    let filtered = books.filter(book => {
      const matchesSearch = !searchQuery || 
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (book.isbn && book.isbn.includes(searchQuery));
      
      const matchesCategory = !selectedCategory || 
        book.category === selectedCategory || 
        (book.tags && book.tags.includes(selectedCategory));

      return matchesSearch && matchesCategory;
    });

    this.setData({ filteredBooks: filtered });
  },


  onBookClick: function(e) {
    const bookId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/bookdetail/bookdetail?id=' + bookId
    });
  },

  onToggleWishlist: function(e) {
    const bookId = e.currentTarget.dataset.id;
    let wishlist = this.data.wishlist || [];
    
    const index = wishlist.indexOf(bookId);
    if (index > -1) {
      wishlist = wishlist.filter(id => id !== bookId);
    } else {
      wishlist = [...wishlist, bookId];
    }
    
    this.setData({ wishlist });
    wx.setStorageSync('wishlist', wishlist);
    // keep global copy in sync for other pages
    const app = getApp();
    if (app && app.globalData) app.globalData.wishlist = wishlist;
  },

  onShowInstructions: function() {
    wx.showModal({
      title: '使用说明',
      content: '欢迎使用BookCycle二手书交易平台！您可以浏览、搜索和购买二手书籍，也可以发布自己的书籍进行出售。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  onPullDownRefresh: function() {
    this.loadBooks();
    wx.stopPullDownRefresh();
  }
});
