/**
 * @file websocket.js
 * @description Manages WebSocket connections for real-time chat and notifications.
 * Handles connection, reconnection, heartbeats, and message dispatching.
 */
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

  /**
   * Initializes the WebSocket service with a URL.
   * If a token exists, it attempts to connect immediately.
   * @param {string} url - The WebSocket server URL.
   */
  init(url) {
    this.url = url;
    // If token exists, try to connect; otherwise wait for login
    const token = wx.getStorageSync('token');
    if (token) {
        this.connect();
    }
  }

  /**
   * Establishes the WebSocket connection.
   * Attaches token to the URL query parameters.
   */
  connect() {
    if (this.socketOpen) return;
    
    const token = wx.getStorageSync('token');
    if (!token) {
        console.warn('WebSocket: No token, skipping connection');
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

  /**
   * Schedules a reconnection attempt.
   */
  reconnect() {
    if (this.socketOpen) return;
    console.log(`Reconnecting in ${this.reconnectInterval}ms...`);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  /**
   * Starts the heartbeat mechanism to keep the connection alive.
   */
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

  /**
   * Stops the heartbeat mechanism.
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Handles incoming WebSocket messages.
   * Dispatches messages to the current page if applicable.
   * Updates global unread count.
   * @param {Object} res - The message event object.
   */
  onMessage(res) {
    console.log('Received message:', res.data);
    if (res.data === 'pong') {
        // Heartbeat response
        return;
    }

    try {
      const msg = JSON.parse(res.data);
      
      // Get current page
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      
      // If current page is chat detail, update message list directly
      if (currentPage && currentPage.route && currentPage.route.includes('chatdetail')) {
        if (currentPage.onNewMessage) {
          currentPage.onNewMessage(msg);
        }
      }
      
      // Update unread count (simple simulation, should use global state management)
      const app = getApp();
      if (app && app.globalData) {
        app.globalData.unreadCount = (app.globalData.unreadCount || 0) + 1;
        // If has TabBar, update Badge
        if (typeof wx.setTabBarBadge === 'function') {
           // wx.setTabBarBadge(...) // Need to check if on TabBar page
        }
      }
      
      // Trigger global event (if current page implements onMessage)
      if (currentPage && currentPage.onMessage) {
        currentPage.onMessage(msg);
      }

    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  }
  
  /**
   * Closes the WebSocket connection and stops reconnection attempts.
   */
  close() {
      this.shouldReconnect = false;
      this.stopHeartbeat();
      if (this.socketTask) {
          this.socketTask.close();
      }
  }
}

export default new WebSocketService();
