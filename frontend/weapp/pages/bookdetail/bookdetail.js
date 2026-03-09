// pages/bookdetail/bookdetail.js
const { requestWithRetry } = require('../../utils/request');
const storage = require('../../utils/storage');
const config = require('../../config/index');
const mockBooks = require('../../mock/books');
// getApp might not be available in test environment immediately
const getAppSafe = () => {
    try {
        return getApp();
    } catch (e) {
        return { globalData: { apiBase: 'http://localhost:8080' } };
    }
};
const app = getAppSafe();

Page({
  data: {
    bookId: '',
    book: null,
    seller: null,
    isWishlisted: false,
    loading: true,
    error: null
  },

  onLoad: function(options) {
    const bookId = options.id;
    this.setData({ bookId: bookId });
    this.loadBook(bookId);
    
    // Check wishlist using storage utility
    const wishlist = storage.get('wishlist') || [];
    this.setData({ isWishlisted: wishlist.indexOf(bookId) > -1 });
  },

  /**
   * Loads book details by ID.
   * First tries to fetch from Cloud Database (if available), then falls back to REST API.
   * If both fail, it attempts to load from local storage.
   * @param {string} bookId - The ID of the book to load.
   */
  loadBook: function(bookId) {
    const that = this;
    this.setData({ loading: true, error: null });
    
    // 0. Use Mock Data if configured
    if (config.useMock) {
        console.log('Using mock data for book:', bookId);
        const book = mockBooks.getById(bookId);
        if (book) {
            // Simulate network delay
            setTimeout(() => {
                that.setData({ book: book, loading: false });
                // Mock seller info
                that.setData({
                    seller: {
                        id: book.sellerId,
                        name: 'Mock Seller',
                        avatar: '',
                        verified: true
                    }
                });
            }, 500);
        } else {
            that.handleError('Book not found (Mock)');
        }
        return;
    }

    // 1. Try to get from passed event channel or global data if available (optional optimization)

    // 2. Try API/Cloud
    if (config.features.enableCloud && wx.cloud && wx.cloud.database) {
      const db = wx.cloud.database();
      db.collection('books').doc(bookId).get().then(res => {
        const book = res.data;
        if (book) {
          that.setData({ book: book });
          that.loadSellerInfo(book.sellerId);
        } else {
            that.handleError('Book not found');
        }
      }).catch(err => {
        console.error('Cloud fetch failed', err);
        that.loadFromLocal(bookId);
      });
    } else {
      // Use API
      requestWithRetry({
          url: app.globalData.apiBase + '/api/books/' + bookId,
          method: 'GET'
      }).then(res => {
          const book = res.data.data || res.data; // Adapt to API response
          that.setData({ book: book });
          if (book.sellerId) {
              that.loadSellerInfo(book.sellerId);
          } else {
              that.setData({ loading: false });
          }
      }).catch(err => {
          console.error('API fetch failed', err);
          that.loadFromLocal(bookId);
      });
    }
  },

  /**
   * Fallback method to load book from local storage.
   * Useful when offline or when API fails.
   * @param {string} bookId - The ID of the book to find.
   */
  loadFromLocal: function(bookId) {
      // Try to find in local storage (e.g. my listings or cached books)
      const myBooks = storage.get('myBooks') || [];
      const foundBook = myBooks.find(b => b.id === bookId || b._id === bookId);
      
      if (foundBook) {
          this.setData({ book: foundBook, loading: false });
          // If it's my book, I am the seller
          if (app.globalData.userInfo) {
              this.setData({
                  seller: {
                      id: app.globalData.userInfo.id || app.globalData.userInfo._id,
                      name: app.globalData.userInfo.nickname || app.globalData.userInfo.name,
                      avatar: app.globalData.userInfo.avatarUrl || app.globalData.userInfo.avatar,
                      verified: true
                  }
              });
          }
      } else {
          this.handleError('Cannot load book details, please check network');
      }
  },

  handleError: function(msg) {
      this.setData({ loading: false, error: msg });
      wx.showToast({ title: msg, icon: 'none' });
  },

  /**
   * Loads seller information by ID.
   * @param {string} sellerId - The ID of the seller.
   */
  loadSellerInfo: function(sellerId) {
    const that = this;
    if (!sellerId) return;

    if (config.features.enableCloud && wx.cloud && wx.cloud.database) {
      const db = wx.cloud.database();
      db.collection('users').doc(sellerId).get().then(res => {
          that.setData({
            seller: {
              id: sellerId,
              name: res.data.name || 'Unknown',
              avatar: res.data.avatar || '',
              sales: res.data.sales || 0,
              trustScore: res.data.trustScore || 0,
              verified: res.data.verified || false
            },
            loading: false
          });
      }).catch(() => {
        that.setData({ loading: false }); // Ignore seller error, show book
      });
    } else {
        requestWithRetry({
            url: app.globalData.apiBase + '/api/users/' + sellerId,
            method: 'GET'
        }).then(res => {
            const user = res.data.data || res.data;
            that.setData({
                seller: {
                    id: sellerId,
                    name: user.name || 'Unknown',
                    avatar: user.avatar || '',
                    sales: user.sales || 0,
                    trustScore: user.trustScore || 0,
                    verified: user.verified || false
                },
                loading: false
            });
        }).catch(() => {
            that.setData({ loading: false });
        });
    }
  },

  /**
   * Toggles the wishlist status of the current book.
   * Updates local storage and component state.
   */
  onToggleWishlist: function() {
    const bookId = this.data.bookId;
    let wishlist = storage.get('wishlist') || [];
    
    const index = wishlist.indexOf(bookId);
    if (index > -1) {
      wishlist.splice(index, 1);
    } else {
      wishlist.push(bookId);
    }
    
    storage.set('wishlist', wishlist);
    this.setData({ isWishlisted: index === -1 });
    
    wx.showToast({
      title: index > -1 ? 'Removed from wishlist' : 'Added to wishlist',
      icon: 'none'
    });
  },

  /**
   * Navigates to the chat page with the seller.
   */
  onChatSeller: function() {
    if (!this.data.seller) return;
    const sellerId = this.data.seller.id || this.data.seller._id;
    wx.navigateTo({
      url: '/pages/chatdetail/chatdetail?userId=' + sellerId
    });
  }
});
