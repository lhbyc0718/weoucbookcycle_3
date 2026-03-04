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
    myAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
    scrollIntoView: ''
  },

  onLoad: function(options) {
    const chatId = options.id;
    const userId = options.userId;
    
    this.setData({
      chatId: chatId || '',
      userId: userId || ''
    });

    if (chatId) {
      this.loadChat(chatId);
    } else if (userId) {
      this.startNewChat(userId);
    }
  },

  loadChat: function(chatId) {
    const that = this;
    
    // 首先尝试从云数据库获取
    if (wx.cloud && wx.cloud.database) {
      const db = wx.cloud.database();
      db.collection('messages').where({ chatId: chatId }).orderBy('createdAt', 'asc').get().then(res => {
        const msgs = (res.data || []).map(m => ({
          id: m._id,
          senderId: m.senderId,
          text: m.text,
          timestamp: m.timestamp
        }));
        that.setData({ messages: msgs });
        that.scrollToBottom();
      }).catch(() => {
        that.useMockData(chatId);
      });
    } else {
      that.useMockData(chatId);
    }
  },

  useMockData: function(chatId) {
    const that = this;
    // 从本地存储获取
    const storedMessagesMap = wx.getStorageSync('messages') || {};
    const localMessages = storedMessagesMap[chatId] || [];
    const mockMessages = that.getMockMessages(chatId);
    const messagesToShow = localMessages.length > 0 ? localMessages : mockMessages;
    
    that.setData({
      messages: messagesToShow,
      otherUser: that.getMockUser()
    });
    that.scrollToBottom();
  },

  startNewChat: function(userId) {
    const that = this;
    const mockUser = this.getMockUser();
    mockUser.id = userId;
    
    // 生成聊天ID
    const chatId = 'chat_me_' + userId;
    
    // 从本地存储获取消息
    const storedMessagesMap = wx.getStorageSync('messages') || {};
    const localMessages = storedMessagesMap[chatId] || [];
    
    this.setData({
      otherUser: mockUser,
      messages: localMessages,
      chatId: chatId,
      userId: userId
    });
  },

  getMockMessages: function(chatId) {
    const messagesMap = {
      '1': [
        { id: 'm1', senderId: 'alex', text: "Hi! I saw you're interested in this book. It's still available.", timestamp: '10:23 AM' },
        { id: 'm2', senderId: 'me', text: "Hello! Yes, I've been looking for this edition specifically. Is the spine condition really as good as new?", timestamp: '10:25 AM' },
        { id: 'm3', senderId: 'alex', text: "Absolutely. I bought it for a course but ended up using the digital version mostly. It's been sitting on my shelf. I can send a close-up photo if you'd like?", timestamp: '10:26 AM' }
      ],
      '2': [
        { id: 'm4', senderId: 'me', text: 'Is the book "Sapiens" still available?', timestamp: '10:42 AM' },
        { id: 'm5', senderId: 'sarah', text: 'Yes, it is! I can ship it tomorrow.', timestamp: '10:45 AM' }
      ]
    };
    return messagesMap[chatId] || [];
  },

  getMockUser: function() {
    return {
      id: 'alex',
      name: 'Alex Reads',
      avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&h=150&fit=crop'
    };
  },

  onInput: function(e) {
    this.setData({ inputText: e.detail.value });
  },

  onSend: function() {
    const { inputText, chatId, userId, messages } = this.data;
    
    if (!inputText || !inputText.trim()) return;

    // 创建新消息
    const newMessage = {
      id: 'm' + Date.now(),
      senderId: 'me',
      text: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // 确保有chatId
    let currentChatId = chatId;
    if (!currentChatId && userId) {
      currentChatId = 'chat_me_' + userId;
      this.setData({ chatId: currentChatId });
    }

    // 添加到消息列表
    const updatedMessages = messages.concat(newMessage);
    this.setData({
      messages: updatedMessages,
      inputText: ''
    });

    // 保存到本地存储
    try {
      const messagesMap = wx.getStorageSync('messages') || {};
      const existing = messagesMap[currentChatId] || [];
      messagesMap[currentChatId] = existing.concat(newMessage);
      wx.setStorageSync('messages', messagesMap);
    } catch (e) {
      console.warn('保存消息失败', e);
    }

    // 保存到云数据库
    if (wx.cloud && wx.cloud.database) {
      const db = wx.cloud.database();
      db.collection('messages').add({
        data: {
          chatId: currentChatId,
          senderId: 'me',
          text: newMessage.text,
          timestamp: newMessage.timestamp,
          createdAt: Date.now()
        }
      }).catch(() => {});
    }

    this.scrollToBottom();

    // 模拟回复
    setTimeout(() => {
      const otherUserId = userId || 'alex';
      const responseMessage = {
        id: 'm' + (Date.now() + 1),
        senderId: otherUserId,
        text: 'Thanks for your message! I\'ll get back to you soon.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      this.setData({
        messages: this.data.messages.concat(responseMessage)
      });
      
      // 保存回复到本地
      try {
        const messagesMap = wx.getStorageSync('messages') || {};
        const existing = messagesMap[currentChatId] || [];
        messagesMap[currentChatId] = existing.concat(responseMessage);
        wx.setStorageSync('messages', messagesMap);
      } catch (e) {}
      
      this.scrollToBottom();
    }, 1000);
  },

  scrollToBottom: function() {
    const that = this;
    setTimeout(() => {
      const messages = that.data.messages;
      if (messages && messages.length > 0) {
        that.setData({
          scrollIntoView: 'msg-' + messages[messages.length - 1].id
        });
      }
    }, 100);
  }
});
