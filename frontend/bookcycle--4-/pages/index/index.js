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
    ]
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
    // 读取配置判断是否使用云功能
    const useCloud = (app.globalData && app.globalData.useCloud) || false;
    if (useCloud && wx.cloud && wx.cloud.database) {
      const db = wx.cloud.database();
      db.collection('books').get().then(r => {
        let books = r.data || [];
        const local = wx.getStorageSync('myBooks') || [];
        if (local.length) {
          books = local.concat(books);
        }
        that.setData({ books: books, filteredBooks: books });
      }).catch(() => {
        const books = that.getMockBooks();
        const local = wx.getStorageSync('myBooks') || [];
        if (local.length) {
          books = local.concat(books);
        }
        that.setData({ books: books, filteredBooks: books });
      });
    } else {
      // 自建后端逻辑
      wx.request({
        url: app.globalData.apiBase + '/api/init',
        success: function(res) {
          let books = res.data.books || [];
          const local = wx.getStorageSync('myBooks') || [];
          if (local.length) {
            books = local.concat(books);
          }
          that.setData({ books: books, filteredBooks: books });
        },
        fail: function() {
          let books = that.getMockBooks();
          const local = wx.getStorageSync('myBooks') || [];
          if (local.length) {
            books = local.concat(books);
          }
          that.setData({ books: books, filteredBooks: books });
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
        tags: ['Classic', 'Fiction']
      },
      {
        id: '2',
        title: 'The Design of Everyday Things',
        author: 'Don Norman',
        cover: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&h=600&fit=crop',
        price: 45,
        condition: 'Like New',
        category: 'Design',
        tags: ['UX', 'Design', 'Textbook']
      },
      {
        id: '3',
        title: 'Sapiens: A Brief History',
        author: 'Yuval Noah Harari',
        cover: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400&h=600&fit=crop',
        price: 35,
        condition: 'New',
        category: 'History',
        tags: ['History', 'Bestseller']
      },
      {
        id: '4',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        cover: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&h=600&fit=crop',
        price: 55,
        condition: '99% New',
        category: 'Tech',
        tags: ['Programming', 'Computer Science']
      },
      {
        id: '5',
        title: 'Atomic Design Systems',
        author: 'Brad Frost',
        cover: 'https://images.unsplash.com/photo-1505330622279-bf7d7fc918f4?w=400&h=600&fit=crop',
        price: 42,
        condition: '92% New',
        category: 'Design',
        tags: ['Design', 'System']
      }
    ];
  },

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
