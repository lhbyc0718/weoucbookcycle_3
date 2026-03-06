// pages/chatdetail/chatdetail.js
const app = getApp();

Page({
  data: {
    chatId: '',
    userId: '',
    messages: [],
    inputText: '',
    otherUser: {
      id: '',
      name: '',
      avatar: ''
    },
    myAvatar: '',
    scrollIntoView: '',
    loading: false
  },

  onLoad: function(options) {
    const chatId = options.id;
    const userId = options.userId;
    
    // Get current user info
    const userInfo = wx.getStorageSync('userInfo');
    this.setData({
      myAvatar: userInfo ? userInfo.avatar : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
      chatId: chatId || '',
      userId: userId || ''
    });

    if (chatId) {
      this.loadChat(chatId);
    } else if (userId) {
      this.startNewChat(userId);
    }

    // Connect to WebSocket if not already connected
    if (app.websocketService && !app.websocketService.socketOpen) {
      app.websocketService.connect();
    }
    
    // Subscribe to messages
    if (app.websocketService) {
        app.websocketService.onMessage((msg) => {
            if (msg.type === 'message' && msg.chat_id === this.data.chatId) {
                // 去重
                if (this.data.messages.some(m => m.id === msg.id)) {
                    return;
                }
                
                const newMessage = {
                    id: msg.id || ('m' + Date.now()),
                    senderId: msg.from, // Ensure backend sends 'from'
                    text: msg.content,
                    timestamp: new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isMy: msg.from === this.data.userId // 判断是否是自己
                };
                this.setData({
                    messages: this.data.messages.concat(newMessage)
                });
                this.scrollToBottom();
            }
        });
    }
  },

  loadChat: function(chatId) {
    const that = this;
    this.setData({ loading: true });
    
    wx.request({
      url: app.globalData.apiBase + '/api/chats/' + chatId,
      method: 'GET',
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('token')
      },
      success: function(res) {
        if (res.statusCode === 200) {
          const chat = res.data;
          // Determine other user
          const currentUserId = wx.getStorageSync('userInfo').id;
          const other = chat.users.find(u => u.id !== currentUserId);
          
          if (other) {
              that.setData({
                  otherUser: {
                      id: other.id,
                      name: other.username,
                      avatar: other.avatar
                  }
              });
          }

          // Load messages
          that.loadMessages(chatId);
        }
      },
      complete: function() {
          that.setData({ loading: false });
      }
    });
  },

  loadMessages: function(chatId) {
      const that = this;
      wx.request({
          url: app.globalData.apiBase + '/api/chats/' + chatId + '/messages',
          method: 'GET',
          header: {
            'Authorization': 'Bearer ' + wx.getStorageSync('token')
          },
          success: function(res) {
              if (res.statusCode === 200) {
                  const msgs = (res.data.data.messages || []).reverse().map(m => ({
                      id: m.id,
                      senderId: m.sender_id,
                      text: m.content,
                      timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      isMy: m.sender_id === wx.getStorageSync('userInfo').id
                  }));
                  that.setData({ messages: msgs });
                  that.scrollToBottom();
              }
          }
      });
  },

  startNewChat: function(userId) {
    const that = this;
    // Call API to create chat
    wx.request({
        url: app.globalData.apiBase + '/api/chats',
        method: 'POST',
        data: { user_id: userId },
        header: {
            'Authorization': 'Bearer ' + wx.getStorageSync('token')
        },
        success: function(res) {
            if (res.statusCode === 201 || res.statusCode === 200) {
                const chat = res.data;
                that.setData({ chatId: chat.id });
                that.loadChat(chat.id);
            }
        }
    });
  },

  onInput: function(e) {
    this.setData({ inputText: e.detail.value });
  },

  onSend: function() {
    const { inputText, chatId } = this.data;
    const that = this;
    
    if (!inputText || !inputText.trim()) return;

    // Send via API (Backend will broadcast via WS)
    wx.request({
        url: app.globalData.apiBase + '/api/chats/' + chatId + '/messages',
        method: 'POST',
        data: { content: inputText },
        header: {
            'Authorization': 'Bearer ' + wx.getStorageSync('token')
        },
        success: function(res) {
            if (res.statusCode === 201 || res.statusCode === 202) {
                // 不做乐观更新，等待 WebSocket 推送，避免重复
                that.setData({ inputText: '' });
            } 
        }
    });
  },

  scrollToBottom: function() {
    const that = this;
    setTimeout(() => {
      const messages = that.data.messages;
      if (messages && messages.length > 0) {
        that.setData({
          scrollIntoView: 'msg-' + (messages.length - 1) // Using index as ID suffix for simplicity
        });
      }
    }, 100);
  }
});
