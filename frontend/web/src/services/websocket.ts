import { toast } from 'react-hot-toast';

type MessageHandler = (data: any) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private isConnecting = false;

  constructor() {
    // Determine WebSocket URL based on current window location or environment variable
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If VITE_API_BASE is set, extract host from it
    const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
    const apiHost = apiBase.replace(/^http(s)?:\/\//, '');
    
    this.url = `${protocol}//${apiHost}/ws`;
  }

  public connect() {
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const token = localStorage.getItem('authToken');
    
    // Append token to URL if available for authentication
    const wsUrl = token ? `${this.url}?token=${token}` : this.url;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        toast.success('已连接到服务器');
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.socket.onclose = (event) => {
        this.isConnecting = false;
        this.stopHeartbeat();
        console.log('WebSocket disconnected:', event.code, event.reason);
        
        // Don't reconnect if closed cleanly (1000) or if token is invalid (4001/4003 usually)
        if (event.code !== 1000 && event.code !== 4001) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };

    } catch (error) {
      this.isConnecting = false;
      console.error('Failed to connect to WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.close(1000, 'User disconnected');
      this.socket = null;
    }
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  public send(type: string, payload: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('WebSocket is not connected. Message not sent:', type);
      // Optionally queue messages
    }
  }

  public subscribe(type: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)?.add(handler);
  }

  public unsubscribe(type: string, handler: MessageHandler) {
    this.messageHandlers.get(type)?.delete(handler);
  }

  private handleMessage(message: any) {
    const { type, payload } = message;
    
    // Handle specific system messages if needed
    if (type === 'pong') {
      // Heartbeat response
      return;
    }

    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.forEach(handler => handler(payload));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      toast.error('无法连接到服务器，请刷新页面重试');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // Send ping every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export const wsService = new WebSocketService();
