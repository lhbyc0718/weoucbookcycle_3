// pages/sellerlisting/sellerlisting.js
const app = getApp();

Page({
  data: {
    sellerId: '',
    seller: {
      id: '',
      name: '',
      avatar: '',
      sales: 0,
      trustScore: 0,
      verified: false
    },
    books: [],
    sellerBooks: [],
    searchQuery: ''
  },

  onLoad: function(options) {
    const sellerId = options.sellerId;
    this.setData({ sellerId });
    this.loadSellerData(sellerId);
  },

  onBack: function() {
    wx.navigateBack();
  },

  loadSellerData: function(sellerId) {
    const that = this;
    
    // 首先尝试从云数据库获取
    if (wx.cloud && wx.cloud.database) {
      const db = wx.cloud.database();
      
      // 获取卖家信息
      db.collection('users').where({
        _id: sellerId
      }).get().then(res => {
        if (res.data && res.data.length > 0) {
          const u = res.data[0];
          that.setData({
            seller: {
              id: sellerId,
              name: u.name || 'Unknown Seller',
              avatar: u.avatar || '',
              sales: u.sales || 0,
              trustScore: u.trustScore || 0,
              verified: u.verified || false
            }
          });
        } else {
          that.setData({ seller: that.getMockSeller(sellerId) });
        }
      }).catch(() => {
        that.setData({ seller: that.getMockSeller(sellerId) });
      });
      
      // 获取卖家书籍
      db.collection('books').where({
        sellerId: sellerId
      }).get().then(res => {
        const books = res.data || [];
        // 合并本地存储的书籍
        const local = wx.getStorageSync('myBooks') || [];
        const localBooks = local.filter(b => b.sellerId === sellerId);
        const allBooks = books.concat(localBooks);
        that.setData({
          books: allBooks,
          sellerBooks: allBooks
        });
      }).catch(() => {
        that.useMockBooks(sellerId);
      });
    } else {
      // 使用本地数据
      that.useMockBooks(sellerId);
    }
  },

  useMockBooks: function(sellerId) {
    const that = this;
    // 从本地存储获取
    const local = wx.getStorageSync('myBooks') || [];
    const localBooks = local.filter(b => b.sellerId === sellerId);
    const mockBooks = that.getMockBooks();
    const allBooks = mockBooks.concat(localBooks);
    const seller = that.getMockSeller(sellerId);
    
    that.setData({
      books: allBooks,
      sellerBooks: allBooks,
      seller: seller
    });
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
        sellerId: 'alex',
        location: 'Shanghai, CN',
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
        sellerId: 'alex',
        location: 'Shanghai, CN',
        tags: ['UX', 'Design', 'Textbook']
      }
    ];
  },

  getMockSeller: function(sellerId) {
    const sellers = {
      'alex': {
        id: 'alex',
        name: 'Alex Reads',
        avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&h=150&fit=crop',
        sales: 156,
        trustScore: 100,
        verified: true
      },
      'sarah': {
        id: 'sarah',
        name: 'Sarah Jenkins',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
        sales: 89,
        trustScore: 95,
        verified: true
      }
    };
    return sellers[sellerId] || { id: sellerId, name: 'Unknown Seller', avatar: '', sales: 0, trustScore: 0, verified: false };
  },

  onSearchInput: function(e) {
    const query = e.detail.value;
    this.setData({ searchQuery: query });
    this.filterBooks();
  },

  filterBooks: function() {
    const { books, searchQuery } = this.data;
    
    if (!searchQuery) {
      this.setData({ sellerBooks: books });
      return;
    }
    
    const filtered = books.filter(book => {
      return (book.title && book.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
             (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase()));
    });
    
    this.setData({ sellerBooks: filtered });
  },

  onBookClick: function(e) {
    const bookId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/bookdetail/bookdetail?id=' + bookId
    });
  },

  onToggleWishlist: function(e) {
    const bookId = e.currentTarget.dataset.id;
    let wishlist = wx.getStorageSync('wishlist') || [];
    
    const index = wishlist.indexOf(bookId);
    if (index > -1) {
      wishlist.splice(index, 1);
    } else {
      wishlist.push(bookId);
    }
    
    wx.setStorageSync('wishlist', wishlist);
  }
});
