// pages/messages/messages.js
const app = getApp();
const request = require('../../utils/request');

Page({
  data: {
    searchQuery: '',
    chats: [],
    users: {},
    activeUsers: [],
    filteredChats: [],
    loading: true
  },

  onLoad: function() {
    this.loadData();
  },

  onShow: function() {
    this.loadData();
    
    // 启动消息轮询（每4秒检查一次新消息）
    const that = this;
    if (this._poller) {
      clearInterval(this._poller);
      this._poller = null;
    }
    this._poller = setInterval(() => {
      that.checkForIncomingMessages();
    }, 4000);
  },

  onHide: function() {
    if (this._poller) {
      clearInterval(this._poller);
      this._poller = null;
    }
  },

  /**
   * 加载数据：获取用户列表和聊天列表
   */
  loadData: function() {
    const that = this;
    this.setData({ loading: true });

    // 并行获取用户和聊天列表
    Promise.all([
      request.get('/api/users'),
      request.get('/api/chats')
    ]).then(([usersResponse, chatsResponse]) => {
      // 格式化用户数据
      const users = {};
      if (Array.isArray(usersResponse)) {
        usersResponse.forEach(u => {
          users[u.id] = u;
        });
      } else if (typeof usersResponse === 'object') {
        Object.assign(users, usersResponse);
      }

      // 格式化聊天数据
      const chats = Array.isArray(chatsResponse) ? chatsResponse : [];
      const storedMessagesMap = wx.getStorageSync('messages') || {};

      // 处理聊天列表
      const processedChats = chats.map(chat => {
        // 确定对方用户ID
        const otherUserId = chat.participantId || (chat.participants ? 
          chat.participants.find(p => p !== app.globalData.userInfo?.id && p !== 'me') : 
          null);
        
        const user = otherUserId ? users[otherUserId] : {};
        const localMsgs = storedMessagesMap[chat.id] || [];
        const lastLocal = localMsgs.length ? localMsgs[localMsgs.length - 1] : null;

        return {
          id: chat.id,
          ...chat,
          name: user.nickname || user.name || chat.userName || 'Unknown',
          avatar: user.avatar || '',
          lastMessage: lastLocal ? lastLocal.text : (chat.lastMessage || ''),
          lastMessageTime: lastLocal ? lastLocal.timestamp : (chat.lastMessageTime || new Date()),
          unreadCount: chat.unreadCount || 0
        };
      });

      const activeUsersList = Object.values(users).filter(u => 
        u && u.id !== (app.globalData.userInfo?.id || 'me')
      );

      that.setData({ 
        users, 
        chats: processedChats, 
        activeUsers: activeUsersList, 
        filteredChats: processedChats,
        loading: false 
      });
    }).catch((error) => {
      console.error('Failed to load data:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none',
        duration: 2000
      });
      that.setData({ loading: false });
      
      // 尝试使用模拟数据作为后备
      this._loadMockData();
    });
  },

  /**
   * 检查新消息（轮询）
   */
  checkForIncomingMessages: function() {
    const storedMessagesMap = wx.getStorageSync('messages') || {};
    const notifiedLast = wx.getStorageSync('notifiedLast') || {};
    let chats = this.data.chats || [];
    let sawNew = false;

    // 从后端获取最新消息
    request.get('/api/chats').then(chatsResponse => {
      const newChats = Array.isArray(chatsResponse) ? chatsResponse : [];
      const users = this.data.users || {};

      newChats.forEach(newChat => {
        // 查找是否已存在
        const existingIndex = chats.findIndex(c => c.id === newChat.id);
        const otherUserId = newChat.participantId || (newChat.participants ? 
          newChat.participants.find(p => p !== app.globalData.userInfo?.id) : 
          null);
        
        const user = otherUserId ? users[otherUserId] : {};
        const localMsgs = storedMessagesMap[newChat.id] || [];
        const lastLocal = localMsgs.length ? localMsgs[localMsgs.length - 1] : null;

        // 检查是否有新消息需要通知
        const lastNotified = notifiedLast[newChat.id];
        if (lastLocal && lastLocal.senderId !== 'me' && lastNotified !== lastLocal.id) {
          sawNew = true;
          notifiedLast[newChat.id] = lastLocal.id;
        }

        const processedChat = {
          id: newChat.id,
          ...newChat,
          name: user.nickname || user.name || newChat.userName || 'Unknown',
          avatar: user.avatar || '',
          lastMessage: lastLocal ? lastLocal.text : (newChat.lastMessage || ''),
          lastMessageTime: lastLocal ? lastLocal.timestamp : (newChat.lastMessageTime || new Date()),
          unreadCount: newChat.unreadCount || 0
        };

        if (existingIndex >= 0) {
          chats[existingIndex] = processedChat;
        } else {
          chats.push(processedChat);
        }
      });

      if (sawNew) {
        try {
          wx.setStorageSync('notifiedLast', notifiedLast);
        } catch (e) {
          console.error('Failed to store notification state:', e);
        }

        this.setData({ chats, filteredChats: chats });
        wx.showToast({
          title: '您有新消息',
          icon: 'none',
          duration: 1500
        });
        if (wx.vibrateShort) {
          wx.vibrateShort();
        }
      }
    }).catch((error) => {
      console.error('Failed to check for messages:', error);
    });
  },

  /**
   * 加载模拟数据
   */
  _loadMockData: function() {
    const mockUsers = this.getMockUsers();
    const mockChats = this.getMockChats();
    
    this.setData({
      users: mockUsers,
      chats: mockChats,
      activeUsers: Object.values(mockUsers).filter(u => u.id !== 'me'),
      filteredChats: mockChats,
      loading: false
    });
  },

  /**
   * 获取模拟用户数据
   */
  getMockUsers: function() {
    return {
      'alex': {
        id: 'alex',
        nickname: 'Alex Reads',
        name: 'Alex Reads',
        avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&h=150&fit=crop'
      },
      'sarah': {
        id: 'sarah',
        nickname: 'Sarah Jenkins',
        name: 'Sarah Jenkins',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop'
      }
    };
  },

  /**
   * 获取模拟聊天数据
   */
  getMockChats: function() {
    return [
      {
        id: '1',
        participantId: 'alex',
        participants: ['me', 'alex'],
        userName: 'Alex Reads',
        lastMessage: "我可以发一张特写照片，如果你想要的话",
        lastMessageTime: new Date(),
        unreadCount: 0
      },
      {
        id: '2',
        participantId: 'sarah',
        participants: ['me', 'sarah'],
        userName: 'Sarah Jenkins',
        lastMessage: '请问"Sapiens"这本书还有吗？',
        lastMessageTime: new Date(),
        unreadCount: 1
      }
    ];
  },

  /**
   * 搜索输入处理
   */
  onSearchInput: function(e) {
    const query = e.detail.value;
    this.setData({ searchQuery: query });
    this.filterChats();
  },

  /**
   * 过滤聊天列表
   */
  filterChats: function() {
    const { chats, searchQuery } = this.data;
    
    const filtered = chats.filter(chat => {
      const chatName = chat.name || '';
      const lastMsg = chat.lastMessage || '';
      return chatName.toLowerCase().includes(searchQuery.toLowerCase()) ||
             lastMsg.toLowerCase().includes(searchQuery.toLowerCase());
    });

    this.setData({ filteredChats: filtered });
  },

  /**
   * 点击聊天
   */
  onChatClick: function(e) {
    const chatId = e.currentTarget.dataset.chatid;
    wx.navigateTo({
      url: '/pages/chatdetail/chatdetail?id=' + chatId
    });
  },

  /**
   * 点击用户开始新聊天
   */
  onUserClick: function(e) {
    const userId = e.currentTarget.dataset.userid;
    wx.navigateTo({
      url: '/pages/chatdetail/chatdetail?userId=' + userId
    });
  },

  /**
   * 显示使用说明
   */
  onShowInstructions: function() {
    wx.showModal({
      title: '消息',
      content: '在这里你可以与卖家聊天洽询你感兴趣的书籍',
      showCancel: false,
      confirmText: '我知道了'
    });
  }
});,

  getMockUsers: function() {
    return {
      'alex': {
        id: 'alex',
        name: 'Alex Reads',
        avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&h=150&fit=crop'
      },
      'sarah': {
        id: 'sarah',
        name: 'Sarah Jenkins',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop'
      }
    };
  },

  getMockChats: function() {
    return [
      {
        id: '1',
        participants: ['me', 'alex'],
        lastMessage: "I can send a close-up photo if you'd like?",
        lastMessageTime: '10:26 AM',
        unreadCount: 0
      },
      {
        id: '2',
        participants: ['me', 'sarah'],
        lastMessage: 'Is the book "Sapiens" still available?',
        lastMessageTime: '10:42 AM',
        unreadCount: 1
      }
    ];
  },

  onSearchInput: function(e) {
    const query = e.detail.value;
    this.setData({ searchQuery: query });
    this.filterChats();
  },

  filterChats: function() {
    const { chats, searchQuery } = this.data;
    
    const filtered = chats.filter(chat => {
      const chatName = chat.name || '';
      const lastMsg = chat.lastMessage || '';
      return chatName.toLowerCase().includes(searchQuery.toLowerCase()) ||
             lastMsg.toLowerCase().includes(searchQuery.toLowerCase());
    });

    this.setData({ filteredChats: filtered });
  },

  onChatClick: function(e) {
    const chatId = e.currentTarget.dataset.chatid;
    wx.navigateTo({
      url: '/pages/chatdetail/chatdetail?id=' + chatId
    });
  },

  onUserClick: function(e) {
    const userId = e.currentTarget.dataset.userid;
    // Start a new chat
    wx.navigateTo({
      url: '/pages/chatdetail/chatdetail?userId=' + userId
    });
  },

  onShowInstructions: function() {
    wx.showModal({
      title: 'Messages',
      content: 'Here you can chat with sellers about books you are interested in.',
      showCancel: false,
      confirmText: 'Got it'
    });
  }
});
