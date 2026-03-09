// pages/market/market.js
const app = getApp();
const debounce = require('../../utils/debounce');
const { requestWithRetry } = require('../../utils/request');
const storage = require('../../utils/storage');

Page({
  data: {
    searchQuery: '',
    showFilters: false,
    selectedCategory: null,
    selectedCondition: null,
    selectedLocation: null,
    wishlist: [],
    books: [],
    filteredBooks: [],
    categories: [
      'Used Books', 
      'Textbook', 
      'Non-Textbook', 
      'New Book', 
      'QR Code for English Books'
    ],
    conditions: [],
    locations: [],
    activeFilterCount: 0,
    loading: false,
    page: 1,
    hasMore: true
  },

  onLoad: function() {
    this.loadBooks(false);
    const wishlist = storage.get('wishlist') || [];
    this.setData({ wishlist });

    // Initialize debounced search
    this.debouncedSearch = debounce((query) => {
      this.setData({ searchQuery: query });
      this.filterBooks();
    }, 300);
  },

  onShow: function() {
    if (this.data.books.length === 0) {
      this.loadBooks(false);
    }
    const wishlist = storage.get('wishlist') || (getApp() && getApp().globalData && getApp().globalData.wishlist) || [];
    this.setData({ wishlist });
  },

  onReachBottom: function() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadBooks(true);
    }
  },

  loadBooks: function(loadMore = false) {
    const that = this;
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    const page = loadMore ? this.data.page + 1 : 1;
    
    // Use unified request with retry
    requestWithRetry({
      url: app.globalData.apiBase + '/api/books', 
      data: {
        page: page,
        limit: 10
      },
      method: 'GET'
    }).then(res => {
        let newBooks = [];
        // Handle different response structures
        if (res.data && Array.isArray(res.data)) {
            newBooks = res.data;
        } else if (res.data && res.data.data && Array.isArray(res.data.data)) {
            newBooks = res.data.data;
        } else if (res.data && res.data.books && Array.isArray(res.data.books)) {
            newBooks = res.data.books;
        }

        const conditions = [...new Set(newBooks.map(b => b.condition).filter(Boolean))];
        const locations = [...new Set(newBooks.map(b => b.location).filter(Boolean))];
        
        let allBooks = loadMore ? that.data.books.concat(newBooks) : newBooks;
        
        const allConditions = [...new Set(allBooks.map(b => b.condition).filter(Boolean))];
        const allLocations = [...new Set(allBooks.map(b => b.location).filter(Boolean))];

        that.setData({ 
            books: allBooks, 
            filteredBooks: allBooks, 
            conditions: allConditions, 
            locations: allLocations,
            loading: false,
            page: page,
            hasMore: newBooks.length > 0 
        });
        
        // Re-apply filters if any
        if (that.data.searchQuery || that.data.selectedCategory || that.data.selectedCondition || that.data.selectedLocation) {
            that.filterBooks();
        }
    }).catch(err => {
        console.error('Failed to load books:', err);
        that.setData({ loading: false });
        // Error handling is done in requestWithRetry but we can show specific toast if needed
    });
  },

  onSearchInput: function(e) {
    this.debouncedSearch(e.detail.value);
  },

  toggleFilters: function() {
    this.setData({ showFilters: !this.data.showFilters });
  },

  onCategoryTap: function(e) {
    const category = e.currentTarget.dataset.category;
    const current = this.data.selectedCategory;
    this.setData({ 
      selectedCategory: current === category ? null : category 
    });
    this.updateFilterCount();
    this.filterBooks();
  },

  onConditionTap: function(e) {
    const condition = e.currentTarget.dataset.condition;
    const current = this.data.selectedCondition;
    this.setData({ 
      selectedCondition: current === condition ? null : condition 
    });
    this.updateFilterCount();
    this.filterBooks();
  },

  onLocationTap: function(e) {
    const location = e.currentTarget.dataset.location;
    const current = this.data.selectedLocation;
    this.setData({ 
      selectedLocation: current === location ? null : location 
    });
    this.updateFilterCount();
    this.filterBooks();
  },

  updateFilterCount: function() {
    const count = [this.data.selectedCategory, this.data.selectedCondition, this.data.selectedLocation].filter(Boolean).length;
    this.setData({ activeFilterCount: count });
  },

  clearFilters: function() {
    this.setData({
      selectedCategory: null,
      selectedCondition: null,
      selectedLocation: null,
      showFilters: false,
      activeFilterCount: 0
    });
    this.filterBooks();
  },

  filterBooks: function() {
    const { books, searchQuery, selectedCategory, selectedCondition, selectedLocation } = this.data;
    
    const filtered = books.filter(book => {
      const matchesSearch = !searchQuery || 
        (book.title && book.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = !selectedCategory || book.category === selectedCategory;
      const matchesCondition = !selectedCondition || book.condition === selectedCondition;
      const matchesLocation = !selectedLocation || book.location === selectedLocation;

      return matchesSearch && matchesCategory && matchesCondition && matchesLocation;
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
    storage.set('wishlist', wishlist);
    const app = getApp();
    if (app && app.globalData) app.globalData.wishlist = wishlist;
  }
});
