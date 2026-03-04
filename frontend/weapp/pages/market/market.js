// pages/market/market.js
const app = getApp();

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
    activeFilterCount: 0
  },

  onLoad: function() {
    this.loadBooks();
    const wishlist = wx.getStorageSync('wishlist') || [];
    this.setData({ wishlist });
  },

  onShow: function() {
    this.loadBooks();
    const wishlist = wx.getStorageSync('wishlist') || (getApp() && getApp().globalData && getApp().globalData.wishlist) || [];
    this.setData({ wishlist });
  },

  loadBooks: function() {
    const that = this;
    if (wx.cloud && wx.cloud.database) {
      const db = wx.cloud.database();
      db.collection('books').get().then(r => {
        let books = r.data || [];
        const local = wx.getStorageSync('myBooks') || [];
        if (local.length) {
          books = local.concat(books);
        }
        const conditions = [...new Set(books.map(b => b.condition).filter(Boolean))];
        const locations = [...new Set(books.map(b => b.location).filter(Boolean))];
        that.setData({ books: books, filteredBooks: books, conditions, locations });
      }).catch(() => {
        let mockBooks = that.getMockBooks();
        const local = wx.getStorageSync('myBooks') || [];
        if (local.length) {
          mockBooks = local.concat(mockBooks);
        }
        const conditions = [...new Set(mockBooks.map(b => b.condition).filter(Boolean))];
        const locations = [...new Set(mockBooks.map(b => b.location).filter(Boolean))];
        that.setData({ books: mockBooks, filteredBooks: mockBooks, conditions, locations });
      });
    } else {
      wx.request({
        url: app.globalData.apiBase + '/api/init',
        success: function(res) {
          let books = res.data.books || [];
          const local = wx.getStorageSync('myBooks') || [];
          if (local.length) {
            books = local.concat(books);
          }
          const conditions = [...new Set(books.map(b => b.condition).filter(Boolean))];
          const locations = [...new Set(books.map(b => b.location).filter(Boolean))];
          that.setData({ books: books, filteredBooks: books, conditions, locations });
        },
        fail: function() {
          let mockBooks = that.getMockBooks();
          const local = wx.getStorageSync('myBooks') || [];
          if (local.length) {
            mockBooks = local.concat(mockBooks);
          }
          const conditions = [...new Set(mockBooks.map(b => b.condition).filter(Boolean))];
          const locations = [...new Set(mockBooks.map(b => b.location).filter(Boolean))];
          that.setData({ books: mockBooks, filteredBooks: mockBooks, conditions, locations });
        }
      });
    }
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
        category: 'Literature',
        location: 'Shanghai, CN'
      },
      {
        id: '2',
        title: 'The Design of Everyday Things',
        author: 'Don Norman',
        cover: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&h=600&fit=crop',
        price: 45,
        condition: 'Like New',
        category: 'Design',
        location: 'Shanghai, CN'
      },
      {
        id: '3',
        title: 'Sapiens: A Brief History',
        author: 'Yuval Noah Harari',
        cover: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400&h=600&fit=crop',
        price: 35,
        condition: 'New',
        category: 'History',
        location: 'Beijing, CN'
      }
    ];
  },

  onSearchInput: function(e) {
    this.setData({ searchQuery: e.detail.value });
    this.filterBooks();
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
    wx.setStorageSync('wishlist', wishlist);
    const app = getApp();
    if (app && app.globalData) app.globalData.wishlist = wishlist;
  }
});
