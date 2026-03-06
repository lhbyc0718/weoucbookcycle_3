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
    this.connect();
  }

  connect() {
    if (this.socketOpen) return;
    
    // Close existing task if any (e.g. pending connecting)
    if (this.socketTask) {
        // this.socketTask.close(); 
    }

    this.socketTask = wx.connectSocket({
      url: this.url,
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
    // Dispatch to app or pages if needed
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
