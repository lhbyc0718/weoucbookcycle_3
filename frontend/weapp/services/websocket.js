class WebSocketService {
  constructor() {
    this.url = '';
    this.socketTask = null;
    this.socketOpen = false;
    this.shouldReconnect = true;
    this.reconnectInterval = 5000;
    this.heartbeatInterval = 30000;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
  }

  init(url) {
    this.url = url;
    // 如果已有token，尝试连接；否则等待登录后再连接
    const token = wx.getStorageSync('token');
    if (token) {
        this.connect();
    }
  }

  connect() {
    if (this.socketOpen) return;
    
    const token = wx.getStorageSync('token');
    if (!token) {
        console.log('WebSocket: No token, skipping connection');
        return;
    }

    // Close existing task if any (e.g. pending connecting)
    if (this.socketTask) {
        // this.socketTask.close(); 
    }

    const wsUrl = `${this.url}?token=${token}`;
    console.log('Connecting to WebSocket:', wsUrl);

    this.socketTask = wx.connectSocket({
      url: wsUrl,
      success: () => console.log('WebSocket connecting...')
    });

    this.socketTask.onOpen(() => {
      console.log('WebSocket connected');
      this.socketOpen = true;
      this.startHeartbeat();
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    });

    this.socketTask.onClose((res) => {
      console.log('WebSocket closed', res);
      this.socketOpen = false;
      this.socketTask = null;
      this.stopHeartbeat();
      if (this.shouldReconnect) {
        this.reconnect();
      }
    });

    this.socketTask.onError((err) => {
      console.error('WebSocket error', err);
      // Error usually leads to close, but let's ensure we reconnect
      // The onClose should trigger reconnect.
    });

    this.socketTask.onMessage((res) => {
      this.onMessage(res);
    });
  }

  reconnect() {
    if (this.socketOpen) return;
    console.log(`Reconnecting in ${this.reconnectInterval}ms...`);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socketOpen && this.socketTask) {
        this.socketTask.send({
          data: 'ping',
          success: () => {
             // console.log('Heartbeat sent');
          },
          fail: () => {
            console.error('Heartbeat failed');
            this.socketOpen = false;
            this.reconnect();
          }
        });
      }
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  onMessage(res) {
    console.log('Received message:', res.data);
    if (res.data === 'pong') {
        // Heartbeat response
        return;
    }

    try {
      const msg = JSON.parse(res.data);
      
      // 获取当前页面
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      
      // 如果当前页面是聊天详情页，直接更新消息列表
      if (currentPage && currentPage.route && currentPage.route.includes('chatdetail')) {
        if (currentPage.onNewMessage) {
          currentPage.onNewMessage(msg);
        }
      }
      
      // 更新未读数 (简单模拟，实际应该存入全局状态)
      const app = getApp();
      if (app && app.globalData) {
        app.globalData.unreadCount = (app.globalData.unreadCount || 0) + 1;
        // 如果有TabBar，更新Badge
        if (typeof wx.setTabBarBadge === 'function') {
           // wx.setTabBarBadge(...) // 需要判断是否在TabBar页面
        }
      }
      
      // 触发全局事件 (如果当前页面实现了onMessage)
      if (currentPage && currentPage.onMessage) {
        currentPage.onMessage(msg);
      }

    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  }
  
  close() {
      this.shouldReconnect = false;
      this.stopHeartbeat();
      if (this.socketTask) {
          this.socketTask.close();
      }
  }
}

export default new WebSocketService();
