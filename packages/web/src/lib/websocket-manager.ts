import { getWebSocketUrl } from './runtime-url';
import type { WsMessage } from '@erp/shared';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface OrderPayload {
  orderNumber?: string;
  station?: string;
  workOrderId?: string;
  orderId?: string;
}

export class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private listeners = new Set<() => void>();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private messageHandler: ((data: WsMessage<OrderPayload>) => void) | null = null;
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private readonly baseReconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private messageQueue: unknown[] = [];
  private readonly maxQueueSize = 50;

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  setMessageHandler(handler: ((data: WsMessage<OrderPayload>) => void) | null) {
    this.messageHandler = handler;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  private setStatus(newStatus: ConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.notifyListeners();
    }
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.shouldReconnect = true;
    this.setStatus('connecting');
    const wsUrl = getWebSocketUrl();

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.flushMessageQueue();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WsMessage<OrderPayload>;
          this.messageHandler?.(message);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        this.ws = null;
        this.setStatus('disconnected');
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.setStatus('disconnected');
      };

      this.startPing();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.min(
      this.baseReconnectDelay * 2 ** this.reconnectAttempts + Math.random() * 1000,
      this.maxReconnectDelay,
    );

    this.reconnectAttempts++;
    console.log(`WebSocket: Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => this.connect(), delay);
  }

  private queueMessage(message: unknown) {
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.messageQueue.shift();
    }
    this.messageQueue.push(message);
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  send(message: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return;
    }
    this.queueMessage(message);
  }

  private startPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 30000);
  }

  authenticate(token: string) {
    this.send({ type: 'AUTHENTICATE', payload: { token } });
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }
}

export function getWebSocketManager(): WebSocketManager {
  return WebSocketManager.getInstance();
}

export function disconnectWebSocket(): void {
  WebSocketManager.getInstance().disconnect();
}
