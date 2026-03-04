// pages/bookdetail/bookdetail.js
const app = getApp();

Page({
  data: {
    bookId: '',
    book: {
      title: '',
      author: '',
      cover: '',
      price: 0,
      condition: '',
      description: '',
      category: '',
      tags: [],
      location: '',
      shippingTime: '',
      images: []
    },
    seller: {
      id: '',
      name: '',
      avatar: '',
      sales: 0,
      trustScore: 0,
      verified: false
    },
    isWishlisted: false
  },

  onLoad: function(options) {
    const bookId = options.id;
    this.setData({ bookId: bookId });
    this.loadBook(bookId);
    
    // Check wishlist
    const wishlist = wx.getStorageSync('wishlist') || [];
    this.setData({ isWishlisted: wishlist.indexOf(bookId) > -1 });
  },

  loadBook: function(bookId) {
    const that = this;
    
    // 首先尝试从云数据库获取
    if (wx.cloud && wx.cloud.database) {
      const db = wx.cloud.database();
      db.collection('books').doc(bookId).get().then(res => {
        const book = res.data;
        if (book) {
          that.setData({ book: book });
          // 获取卖家信息
          that.loadSellerInfo(book.sellerId);
        } else {
          that.useMockBook(bookId);
        }
      }).catch(err => {
        console.log('从云获取失败，使用本地数据', err);
        that.useMockBook(bookId);
      });
    } else {
      // 没有云开发，使用本地数据
      that.useMockBook(bookId);
    }
  },

  loadSellerInfo: function(sellerId) {
    const that = this;
    if (wx.cloud && wx.cloud.database) {
      const db = wx.cloud.database();
      db.collection('users').where({
        _id: sellerId
      }).get().then(res => {
        if (res.data && res.data.length > 0) {
          const user = res.data[0];
          that.setData({
            seller: {
              id: sellerId,
              name: user.name || 'Unknown',
              avatar: user.avatar || '',
              sales: user.sales || 0,
              trustScore: user.trustScore || 0,
              verified: user.verified || false
            }
          });
        } else {
          that.setData({ seller: that.getMockSeller(sellerId) });
        }
      }).catch(() => {
        that.setData({ seller: that.getMockSeller(sellerId) });
      });
    } else {
      that.setData({ seller: that.getMockSeller(sellerId) });
    }
  },

  useMockBook: function(bookId) {
    const that = this;
    // 先检查本地存储的书籍
    const localBooks = wx.getStorageSync('myBooks') || [];
    let foundBook = localBooks.find(b => b.id === bookId);
    
    if (foundBook) {
      that.setData({ book: foundBook });
      that.loadSellerInfo(foundBook.sellerId);
      return;
    }
    
    // 使用mock数据
    const mockBook = that.getMockBook(bookId);
    const mockSeller = that.getMockSeller(mockBook.sellerId);
    that.setData({
      book: mockBook,
      seller: mockSeller
    });
  },

  getMockBook: function(id) {
    const books = [
      {
        id: '1',
        title: 'The Great Gatsby (Hardcover)',
        author: 'F. Scott Fitzgerald',
        cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop',
        price: 25,
        condition: '98% New',
        sellerId: 'alex',
        description: 'Classic hardcover edition. Barely read, spine is perfect. No markings inside.',
        category: 'Literature',
        tags: ['Classic', 'Fiction'],
        location: 'Shanghai, CN',
        shippingTime: 'Ships within 24h',
        images: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&h=1200&fit=crop']
      },
      {
        id: '2',
        title: 'The Design of Everyday Things',
        author: 'Don Norman',
        cover: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&h=600&fit=crop',
        price: 45,
        condition: 'Like New',
        sellerId: 'alex',
        description: 'Original English version, bought 2 months ago for a design course.',
        category: 'Design',
        tags: ['UX', 'Design', 'Textbook'],
        location: 'Shanghai, CN',
        shippingTime: 'Ships within 24h',
        images: ['https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=800&h=1200&fit=crop']
      },
      {
        id: '3',
        title: 'Sapiens: A Brief History',
        author: 'Yuval Noah Harari',
        cover: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400&h=600&fit=crop',
        price: 35,
        condition: 'New',
        sellerId: 'sarah',
        description: 'Brand new copy, unwanted gift.',
        category: 'History',
        tags: ['History', 'Bestseller'],
        location: 'Beijing, CN',
        shippingTime: 'Ships within 48h',
        images: ['https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=800&h=1200&fit=crop']
      }
    ];
    return books.find(b => b.id === id) || books[0];
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
    return sellers[sellerId] || sellers['alex'];
  },

  onToggleWishlist: function() {
    const bookId = this.data.bookId;
    let wishlist = wx.getStorageSync('wishlist') || [];
    
    const index = wishlist.indexOf(bookId);
    if (index > -1) {
      wishlist.splice(index, 1);
    } else {
      wishlist.push(bookId);
    }
    
    wx.setStorageSync('wishlist', wishlist);
    this.setData({ isWishlisted: index === -1 });
    
    wx.showToast({
      title: index > -1 ? 'Removed from wishlist' : 'Added to wishlist',
      icon: 'none'
    });
  },

  onChatSeller: function() {
    const sellerId = this.data.book.sellerId;
    wx.navigateTo({
      url: '/pages/chatdetail/chatdetail?userId=' + sellerId
    });
  }
});
