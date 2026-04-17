export type WsStatus = 'connecting' | 'connected' | 'disconnected';

export interface WsMessage {
  type: string;
  payload?: unknown;
  timestamp?: string;
}

export type MessageHandler = (msg: WsMessage) => void;

interface ConnectionConfig {
  token: string;
  apiUrl: string;
}

function normalizeWebSocketUrl(apiUrl: string): string {
  return apiUrl.replace(/^http/, 'ws').replace(/\/api\/v1\/?$/, '/ws');
}

class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private ws: WebSocket | null = null;
  private status: WsStatus = 'disconnected';
  private statusListeners = new Set<() => void>();
  private messageHandlers = new Set<MessageHandler>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private activeConfig: ConnectionConfig | null = null;
  private closingSockets = new WeakSet<WebSocket>();

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  getStatus(): WsStatus {
    return this.status;
  }

  subscribeStatus(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  subscribeMessages(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  private notifyStatus() {
    this.statusListeners.forEach((listener) => listener());
  }

  private setStatus(status: WsStatus) {
    if (this.status === status) {
      return;
    }
    this.status = status;
    this.notifyStatus();
  }

  private clearTimers() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout || !this.shouldReconnect || !this.activeConfig?.token) {
      return;
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.activeConfig?.token) {
        this.connect(this.activeConfig.token, this.activeConfig.apiUrl);
      }
    }, delay);
  }

  connect(token: string, apiUrl: string) {
    this.activeConfig = { token, apiUrl };
    this.shouldReconnect = true;

    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.setStatus('connecting');

    try {
      const ws = new WebSocket(normalizeWebSocketUrl(apiUrl));
      this.ws = ws;

      ws.onopen = () => {
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        ws.send(JSON.stringify({ type: 'AUTHENTICATE', payload: { token } }));

        if (this.pingInterval) {
          clearInterval(this.pingInterval);
        }
        this.pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsMessage;
          this.messageHandlers.forEach((handler) => {
            try {
              handler(msg);
            } catch (error) {
              console.error('WebSocket message handler error:', error);
            }
          });
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      ws.onclose = () => {
        if (this.ws === ws) {
          this.ws = null;
        }
        this.clearTimers();
        this.setStatus('disconnected');

        const wasIntentional = this.closingSockets.has(ws);
        this.closingSockets.delete(ws);

        if (!wasIntentional) {
          this.scheduleReconnect();
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  send(message: WsMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    this.activeConfig = null;
    this.reconnectAttempts = 0;
    this.clearTimers();

    if (this.ws) {
      this.closingSockets.add(this.ws);
      this.ws.close();
      this.ws = null;
    }

    this.setStatus('disconnected');
  }
}

export function getShopFloorWebSocketManager(): WebSocketManager {
  return WebSocketManager.getInstance();
}

export function disconnectShopFloorWebSocket(): void {
  WebSocketManager.getInstance().disconnect();
}
