// Use a type alias for the listener to be explicit
type Listener = (data: any) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Listener[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;

  private pingInterval: any = null;

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = localStorage.getItem('authToken');
    if (!token) return;

    // Determine WS URL based on environment or window location
    let wsUrl = 'ws://localhost:8080/ws';
    
    const apiBase = import.meta.env.VITE_API_BASE;

    if (apiBase) {
      // Replace http/https with ws/wss
      wsUrl = apiBase.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      // If front-end dev server (vite) is running on 517x, backend likely runs on 8080.
      // Previous logic only checked for 5173; broaden to handle any 517* dev port.
      let port = window.location.port;
      if (port && String(port).startsWith('517')) {
        port = '8080';
      }
      const portSuffix = port ? `:${port}` : '';
      wsUrl = `${protocol}//${host}${portSuffix}/ws`;
    }

    console.debug('wsService connecting to', wsUrl);

    // Append token
    wsUrl += `?token=${token}`;

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connect', {});
      this.startHeartbeat();
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Dispatch to specific event listeners if the message has a 'type' field,
        // otherwise (or additionally) dispatch to a generic 'message' event.
        
        // Strategy: 
        // 1. If data.type exists, emit(data.type, data)
        // 2. Always emit('message', data) for generic listeners
        
          if (data.type) {
            this.emit(data.type, data);
            // Only emit generic 'message' for actual chat messages.
            if (data.type === 'message') {
              this.emit('message', data);
            }
          } else {
            // No explicit type: treat as generic message
            this.emit('message', data);
          }
      } catch (e) {
        console.error('WebSocket message parse error', e);
      }
    };

    this.socket.onclose = (event) => {
      console.log(`WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}`);
      this.stopHeartbeat();
      this.attemptReconnect();
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error', error);
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.stopHeartbeat();
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  subscribe(event: string, callback: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  unsubscribe(event: string, callback: Listener) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      this.listeners.set(event, callbacks.filter(cb => cb !== callback));
    }
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), this.reconnectInterval);
    }
  }
}

export const wsService = new WebSocketService();
