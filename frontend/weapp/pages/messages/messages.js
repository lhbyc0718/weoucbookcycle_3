// pages/messages/messages.js
const app = getApp();
const storage = require('../../utils/storage');

Page({
  data: {
    searchQuery: '',
    chats: [],
    users: {},
    activeUsers: [],
    filteredChats: []
  },

  onLoad: function() {
    this.loadData();
  },

  onShow: function() {
    this.loadData();
    // start polling or realtime watcher for incoming messages
    const that = this;
    if (this._poller) { clearInterval(this._poller); this._poller = null; }
    if (this._globalWatcher) { try { this._globalWatcher.close(); } catch (e) {} this._globalWatcher = null; }
    if (wx.cloud && wx.cloud.database) {
      try {
        const db = wx.cloud.database();
        const cmd = db.command;
        this._globalWatcher = db.collection('messages').where({ senderId: cmd.neq('me') }).watch({
          onChange: function(snapshot) {
            // merge incoming cloud messages into local store and notify
            const docs = snapshot.docs || [];
            const stored = storage.get('messages') || {};
            let updated = false;
            docs.forEach(m => {
              const chatId = m.chatId;
              stored[chatId] = stored[chatId] || [];
              if (!stored[chatId].find(x => x.id === m._id)) {
                stored[chatId].push({ id: m._id, senderId: m.senderId, text: m.text, timestamp: m.timestamp });
                updated = true;
              }
            });
            if (updated) {
              storage.set('messages', stored);
              that.loadData();
              try { wx.showToast({ title: '您有新消息', icon: 'none', duration: 1500 }); wx.vibrateShort && wx.vibrateShort(); } catch (e) {}
            }
          },
          onError: function(err) {
            // fallback: start local poller
            if (that._poller) clearInterval(that._poller);
            that._poller = setInterval(() => { that.checkForIncomingMessages(); }, 4000);
          }
        });
      } catch (e) {
        this._poller = setInterval(() => { that.checkForIncomingMessages(); }, 4000);
      }
    } else {
      this._poller = setInterval(() => { that.checkForIncomingMessages(); }, 4000);
    }
  },

  onHide: function() {
    if (this._poller) {
      clearInterval(this._poller);
      this._poller = null;
    }
    if (this._globalWatcher) {
      try { this._globalWatcher.close(); } catch (e) {}
      this._globalWatcher = null;
    }
  },

  loadData: function() {
    const that = this;
    // load users and chats from cloud db when available
    if (wx.cloud && wx.cloud.database) {
      const db = wx.cloud.database();
      Promise.all([
        db.collection('users').get(),
        db.collection('chats').get()
      ]).then(([uRes, cRes]) => {
        const usersArr = uRes.data || [];
        const chatsArr = cRes.data || [];
        const users = {};
        usersArr.forEach(u => { users[u._openid] = u; });
        const storedMessagesMap = storage.get('messages') || {};

        const processedChats = chatsArr.map(chat => {
          const otherUserId = chat.participants ? (chat.participants.find(p => p !== that.globalData.userInfo.id) || chat.participants[0]) : '';
          const user = users[otherUserId] || {};
          const localMsgs = storedMessagesMap[chat._id] || [];
          const lastLocal = localMsgs.length ? localMsgs[localMsgs.length - 1] : null;
          return {
            id: chat._id,
            ...chat,
            name: user.name || 'Unknown',
            avatar: user.avatar || '',
            lastMessage: lastLocal ? lastLocal.text : (chat.lastMessage || ''),
            lastMessageTime: lastLocal ? lastLocal.timestamp : (chat.lastMessageTime || ''),
            unreadCount: chat.unreadCount || 0
          };
        });

        // include chats only in local storage (same code as before)
        Object.keys(storedMessagesMap).forEach(localChatId => {
          const exists = processedChats.find(c => c.id === localChatId);
          if (!exists) {
            const msgs = storedMessagesMap[localChatId];
            const last = msgs && msgs.length ? msgs[msgs.length - 1] : null;
            if (localChatId.indexOf('chat_me_') === 0) {
              const otherId = localChatId.replace('chat_me_', '');
              processedChats.push({
                id: localChatId,
                participants: ['me', otherId],
                name: (users[otherId] && users[otherId].name) ? users[otherId].name : (last && last.senderId && users[last.senderId] ? users[last.senderId].name : 'Unknown'),
                avatar: (users[otherId] && users[otherId].avatar) ? users[otherId].avatar : ((last && last.senderId && users[last.senderId]) ? users[last.senderId].avatar : ''),
                lastMessage: last ? last.text : '',
                lastMessageTime: last ? last.timestamp : '',
                unreadCount: 0
              });
            } else {
              processedChats.push({
                id: localChatId,
                participants: ['me'],
                name: last && last.senderId !== 'me' ? (users[last.senderId] ? users[last.senderId].name : 'Unknown') : 'Unknown',
                avatar: (last && last.senderId && users[last.senderId]) ? users[last.senderId].avatar : '',
                lastMessage: last ? last.text : '',
                lastMessageTime: last ? last.timestamp : '',
                unreadCount: 0
              });
            }
          }
        });
        const activeUsersList = Object.values(users).filter(u => u && u._openid !== that.globalData.userInfo.id);
        that.setData({ users: users, chats: processedChats, activeUsers: activeUsersList, filteredChats: processedChats });
      }).catch(() => {
        // fallback to network logic if cloud query fails
        wx.request({
          url: app.globalData.apiBase + '/api/init',
          success: function(res) {
            const users = res.data.users || {};
            const chats = res.data.chats || [];
            const storedMessagesMap = storage.get('messages') || {};
            const processedChats = chats.map(chat => {
              const otherUserId = chat.participants ? (chat.participants.find(p => p !== 'me') || 'alex') : 'alex';
              const user = users[otherUserId] || {};
              const localMsgs = storedMessagesMap[chat.id] || [];
              const lastLocal = localMsgs.length ? localMsgs[localMsgs.length - 1] : null;
              return {
                ...chat,
                name: user.name || 'Unknown',
                avatar: user.avatar || '',
                lastMessage: lastLocal ? lastLocal.text : (chat.lastMessage || ''),
                lastMessageTime: lastLocal ? lastLocal.timestamp : (chat.lastMessageTime || ''),
                unreadCount: chat.unreadCount || 0
              };
            });
            const activeUsersList = users ? Object.values(users).filter(u => u && u.id !== 'me') : [];
            that.setData({ users: users, chats: processedChats, activeUsers: activeUsersList, filteredChats: processedChats });
          },
          fail: function() {
            // Removed mock data fallback, just show empty state or cached
             const storedMessagesMap = storage.get('messages') || {};
             // We can at least show local chats
             const processedChats = [];
             Object.keys(storedMessagesMap).forEach(localChatId => {
                const msgs = storedMessagesMap[localChatId];
                const last = msgs && msgs.length ? msgs[msgs.length - 1] : null;
                processedChats.push({
                    id: localChatId,
                    participants: ['me'],
                    name: 'Offline Chat',
                    avatar: '',
                    lastMessage: last ? last.text : '',
                    lastMessageTime: last ? last.timestamp : '',
                    unreadCount: 0
                });
             });
             that.setData({ users: {}, chats: processedChats, activeUsers: [], filteredChats: processedChats });
          }
        });
      });
    } else {
      // non-cloud fallback exactly original wx.request behaviour
      wx.request({
        url: app.globalData.apiBase + '/api/init',
        success: function(res) {
          const users = res.data.users || {};
          const chats = res.data.chats || [];
          const storedMessagesMap = storage.get('messages') || {};
          const processedChats = chats.map(chat => {
            const otherUserId = chat.participants ? (chat.participants.find(p => p !== 'me') || 'alex') : 'alex';
            const user = users[otherUserId] || {};
            const localMsgs = storedMessagesMap[chat.id] || [];
            const lastLocal = localMsgs.length ? localMsgs[localMsgs.length - 1] : null;
            return {
              ...chat,
              name: user.name || 'Unknown',
              avatar: user.avatar || '',
              lastMessage: lastLocal ? lastLocal.text : (chat.lastMessage || ''),
              lastMessageTime: lastLocal ? lastLocal.timestamp : (chat.lastMessageTime || ''),
              unreadCount: chat.unreadCount || 0
            };
          });
          // local-only chat code omitted for brevity but can be re-added
          const activeUsersList = users ? Object.values(users).filter(u => u && u.id !== 'me') : [];
          that.setData({ users: users, chats: processedChats, activeUsers: activeUsersList, filteredChats: processedChats });
        },
        fail: function() {
           // Removed mock data fallback
           const storedMessagesMap = storage.get('messages') || {};
           const processedChats = [];
           Object.keys(storedMessagesMap).forEach(localChatId => {
              const msgs = storedMessagesMap[localChatId];
              const last = msgs && msgs.length ? msgs[msgs.length - 1] : null;
              processedChats.push({
                  id: localChatId,
                  participants: ['me'],
                  name: 'Offline Chat',
                  avatar: '',
                  lastMessage: last ? last.text : '',
                  lastMessageTime: last ? last.timestamp : '',
                  unreadCount: 0
              });
           });
           that.setData({ users: {}, chats: processedChats, activeUsers: [], filteredChats: processedChats });
        }
      });
    }
  },

  checkForIncomingMessages: function() {
    const storedMessagesMap = storage.get('messages') || {};
    const lastSeen = storage.get('lastSeen') || {};
    const notifiedLast = storage.get('notifiedLast') || {};
    const chats = this.data.chats || [];
    let sawNew = false;

    // First, check cloud messages if available
    if (wx.cloud && wx.cloud.database) {
      const db = wx.cloud.database();
      const _ = db.command;
      db.collection('messages').where({ senderId: _.neq('me') }).orderBy('createdAt', 'asc').get().then(res => {
        const msgs = res.data || [];
        const messagesMap = { ...storedMessagesMap };
        msgs.forEach(m => {
          const chatId = m.chatId;
          messagesMap[chatId] = messagesMap[chatId] || [];
          // avoid duplicates
          if (!messagesMap[chatId].find(x => x.id === m._id)) {
            const newMsg = { id: m._id, senderId: m.senderId, text: m.text, timestamp: m.timestamp };
            messagesMap[chatId].push(newMsg);
          }

          const last = messagesMap[chatId][messagesMap[chatId].length - 1];
          const seenId = lastSeen[chatId] || null;
          const notifiedId = notifiedLast[chatId] || null;
          if (last && last.senderId !== 'me' && notifiedId !== last.id && seenId !== last.id) {
            sawNew = true;
            // update chats list
            const idx = chats.findIndex(c => c.id === chatId);
            if (idx >= 0) {
              const c = chats[idx];
              const unreadCount = (c.unreadCount || 0) + 1;
              chats[idx] = { ...c, lastMessage: last.text, lastMessageTime: last.timestamp, unreadCount };
            } else {
              chats.push({ id: chatId, participants: ['me'], name: 'New Contact', avatar: '', lastMessage: last.text, lastMessageTime: last.timestamp, unreadCount: 1 });
            }

            // mark notified to avoid repeated toasts
            notifiedLast[chatId] = last.id;
          }
        });

        // save merged messages locally
        storage.set('messages', messagesMap);
        storage.set('notifiedLast', notifiedLast);

        if (sawNew) {
          this.setData({ chats: chats, filteredChats: chats });
          try { wx.showToast({ title: '您有新消息', icon: 'none', duration: 1500 }); wx.vibrateShort && wx.vibrateShort(); } catch (e) {}
        }
      }).catch(() => {
        // fallback to local-only checking below
        this._checkLocalForIncoming(storedMessagesMap, lastSeen, chats);
      });
    } else {
      // no cloud available — check local stored messages
      this._checkLocalForIncoming(storedMessagesMap, lastSeen, chats);
    }
  },

  _checkLocalForIncoming: function(storedMessagesMap, lastSeen, chats) {
    let sawNew = false;
    Object.keys(storedMessagesMap).forEach(chatId => {
      const msgs = storedMessagesMap[chatId] || [];
      if (!msgs.length) return;
      const last = msgs[msgs.length - 1];
      if (last.senderId === 'me') return; // ignore our own latest

      const seenId = lastSeen[chatId] || null;
      if (seenId !== last.id) {
        sawNew = true;

        // update chats list entry if present
        const idx = chats.findIndex(c => c.id === chatId);
        if (idx >= 0) {
          const c = chats[idx];
          const unreadCount = (c.unreadCount || 0) + 1;
          chats[idx] = { ...c, lastMessage: last.text, lastMessageTime: last.timestamp, unreadCount };
        } else {
          // add a minimal entry for local-only chat
          chats.push({ id: chatId, participants: ['me'], name: 'New Contact', avatar: '', lastMessage: last.text, lastMessageTime: last.timestamp, unreadCount: 1 });
        }
      }
    });

    if (sawNew) {
      this.setData({ chats: chats, filteredChats: chats });
      try { wx.showToast({ title: '您有新消息', icon: 'none', duration: 1500 }); wx.vibrateShort && wx.vibrateShort(); } catch (e) {}
    }
  },

  // Removed mock data functions

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
