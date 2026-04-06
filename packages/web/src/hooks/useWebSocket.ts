import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { WsMessageType, type WsMessage } from '@erp/shared';
import { getWebSocketUrl } from '../lib/runtime-url';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface OrderPayload {
  orderNumber?: string;
  station?: string;
  workOrderId?: string;
  orderId?: string;
}

// Singleton WebSocket manager to prevent duplicate connections
class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private listeners = new Set<() => void>();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private messageHandler: ((data: WsMessage<OrderPayload>) => void) | null = null;
  private shouldReconnect = true;
  
  // Exponential backoff for reconnection
  private reconnectAttempts = 0;
  private readonly baseReconnectDelay = 1000; // 1 second
  private readonly maxReconnectDelay = 30000; // 30 seconds
  
  // Message queue for offline messages
  private messageQueue: unknown[] = [];
  private readonly maxQueueSize = 50;

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  setMessageHandler(handler: (data: WsMessage<OrderPayload>) => void) {
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
    // Don't reconnect if already connected or connecting
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
        this.reconnectAttempts = 0; // Reset on successful connection
        this.flushMessageQueue(); // Send any queued messages
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

      // Start ping interval
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

    // Exponential backoff with jitter
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
      this.maxReconnectDelay
    );
    
    this.reconnectAttempts++;
    console.log(`WebSocket: Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => this.connect(), delay);
  }
  
  // Queue a message to be sent when connected
  private queueMessage(message: unknown) {
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.messageQueue.shift(); // Remove oldest message
    }
    this.messageQueue.push(message);
  }
  
  // Send all queued messages
  private flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }
  
  // Send a message, queueing if not connected
  send(message: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.queueMessage(message);
    }
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

  // Authenticate the WebSocket connection
  authenticate(token: string) {
    this.send({ type: 'AUTHENTICATE', payload: { token } });
  }
  
  // Reset reconnection state (for manual retry)
  resetReconnect() {
    this.reconnectAttempts = 0;
    if (this.status === 'disconnected') {
      this.connect();
    }
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

export function useWebSocket() {
  const queryClient = useQueryClient();
  const managerRef = useRef(WebSocketManager.getInstance());
  const [lastMessage, setLastMessage] = useState<WsMessage<OrderPayload> | null>(null);
  
  // Use useSyncExternalStore for proper subscription to status changes
  const status = useSyncExternalStore(
    (callback) => managerRef.current.subscribe(callback),
    () => managerRef.current.getStatus()
  );

  useEffect(() => {
    const manager = managerRef.current;
    const pendingInvalidations = new Set<string>();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleInvalidation = (...keys: string[]) => {
      for (const key of keys) pendingInvalidations.add(key);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        for (const key of pendingInvalidations) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
        pendingInvalidations.clear();
        debounceTimer = null;
      }, 300); // Batch invalidations within 300ms window
    };
    
    // Set up message handler
    manager.setMessageHandler((message) => {
      // Store the last message for consumers
      setLastMessage(message);
      
      // Debounced invalidation — avoids stampeding multiple WS events
      // into dozens of simultaneous refetches

      
      // Targeted order invalidation — only invalidates the specific order
      // if possible, falling back to list invalidation
      const invalidateOrder = (orderNumber?: string) => {
        if (orderNumber) {
          // Invalidate only the specific order detail query
          queryClient.invalidateQueries({ queryKey: ['order', orderNumber] });
          queryClient.invalidateQueries({ queryKey: ['orders', orderNumber] });
        }
        // Always invalidate order lists (they show status/counts)
        scheduleInvalidation('orders', 'dashboard', 'shop-floor-orders', 'order-entry-orders');
      };

      switch (message.type) {
        case 'ORDER_CREATED' as WsMessageType:
          invalidateOrder(message.payload?.orderNumber);
          if (message.payload?.orderNumber) {
            toast.success(`New order #${message.payload.orderNumber} created`, {
              icon: '📋',
              duration: 4000,
            });
          }
          break;
        case 'ORDER_UPDATED' as WsMessageType:
          invalidateOrder(message.payload?.orderNumber);
          break;
        case 'ORDER_DELETED' as WsMessageType:
          invalidateOrder(message.payload?.orderNumber);
          break;
        case WsMessageType.FILE_CHAIN_UPDATED: {
          const fileChainPayload = message.payload as { workOrderId?: string; orderId?: string } | undefined;
          const orderId = fileChainPayload?.workOrderId ?? fileChainPayload?.orderId;
          if (orderId) {
            queryClient.invalidateQueries({ queryKey: ['file-chain', orderId] });
            queryClient.invalidateQueries({ queryKey: ['orders', orderId] });
          }
          break;
        }
        case 'STATION_UPDATED' as WsMessageType:
          invalidateOrder(message.payload?.orderNumber);
          if (message.payload?.orderNumber && message.payload?.station) {
            toast(`Station ${message.payload.station} updated on #${message.payload.orderNumber}`, {
              icon: '🔄',
              duration: 3000,
            });
          }
          break;
        case 'NOTIFICATION_CREATED':
          scheduleInvalidation('notifications');
          // Show a toast for new notifications
          const notificationPayload = message.payload as { title?: string; message?: string } | undefined;
          if (notificationPayload?.title) {
            toast(notificationPayload.title, {
              icon: '🔔',
              duration: 4000,
            });
          }
          break;
        case 'PRINT_JOB_CREATED' as WsMessageType:
        case 'PRINT_JOB_UPDATED' as WsMessageType:
        case 'PRINT_JOB_DELETED' as WsMessageType:
        case 'PRINT_QUEUE_CREATED' as WsMessageType:
        case 'PRINT_QUEUE_UPDATED' as WsMessageType:
        case 'PRINT_QUEUE_DELETED' as WsMessageType:
          scheduleInvalidation('print-queue');
          break;
        case 'PRINT_JOB_STATUS_CHANGED' as WsMessageType: {
          scheduleInvalidation('print-queue');
          const printPayload = message.payload as { jobNumber?: string; status?: string } | undefined;
          if (printPayload?.jobNumber && printPayload?.status) {
            const statusLabel = printPayload.status === 'PRINTING' ? 'started printing' :
              printPayload.status === 'COMPLETED' ? 'completed' :
              printPayload.status === 'DRYING' ? 'moved to drying' :
              `status → ${printPayload.status}`;
            toast(`Print job ${printPayload.jobNumber} ${statusLabel}`, {
              icon: '🖨️',
              duration: 3000,
            });
          }
          break;
        }
        case 'PRINTER_STATUS_CHANGED' as WsMessageType:
          scheduleInvalidation('print-queue');
          break;
        case 'RIP_JOB_CREATED' as WsMessageType:
        case 'RIP_JOB_UPDATED' as WsMessageType:
        case 'RIP_JOB_DELETED' as WsMessageType:
        case 'RIP_JOB_STATUS_SYNC' as WsMessageType:
          scheduleInvalidation('rip-queue');
          break;
        case 'RIP_JOB_STATUS_CHANGED' as WsMessageType: {
          scheduleInvalidation('rip-queue');
          const ripPayload = message.payload as { sourceFileName?: string; status?: string } | undefined;
          if (ripPayload?.sourceFileName && ripPayload?.status) {
            const ripLabel = ripPayload.status === 'PROCESSING' ? 'is being RIPped' :
              ripPayload.status === 'READY' ? 'is ready to print' :
              ripPayload.status === 'PRINTING' ? 'is printing' :
              ripPayload.status === 'COMPLETED' ? 'completed' :
              ripPayload.status === 'FAILED' ? 'failed' :
              `status → ${ripPayload.status}`;
            toast(`RIP: ${ripPayload.sourceFileName} ${ripLabel}`, {
              icon: '🖥️',
              duration: 3000,
            });
          }
          break;
        }
        case 'PRODUCTION_LIST_SYNCED' as WsMessageType: {
          scheduleInvalidation('production-list', 'orders', 'dashboard');
          const syncPayload = message.payload as { imported?: number; updated?: number; errors?: number } | undefined;
          if (syncPayload) {
            toast(`Production List synced: ${syncPayload.imported || 0} imported, ${syncPayload.updated || 0} updated`, {
              icon: '📋',
              duration: 4000,
            });
          }
          break;
        }

        // Equipment events
        case 'EQUIPMENT_LIVE_STATUS' as WsMessageType:
        case 'EQUIPMENT_CREATED' as WsMessageType:
        case 'EQUIPMENT_UPDATED' as WsMessageType:
        case 'EQUIPMENT_STATUS_CHANGED' as WsMessageType:
        case 'EQUIPMENT_DELETED' as WsMessageType:
        case 'EQUIPMENT_DOWN' as WsMessageType:
        case 'EQUIPMENT_RESTORED' as WsMessageType:
          scheduleInvalidation('equipment', 'equipment-status', 'equipment-live-status');
          break;

        // Equipment watch alert events
        case 'EQUIPMENT_WATCH_ALERT' as WsMessageType:
          scheduleInvalidation('equipment-watch-rules');
          break;

        // Purchase order events
        case 'PO_CREATED' as WsMessageType:
        case 'PO_UPDATED' as WsMessageType:
        case 'PO_DELETED' as WsMessageType:
        case 'PURCHASE_ORDER_UPDATED' as WsMessageType:
          scheduleInvalidation('purchase-orders');
          break;

        // Quote events
        case 'QUOTE_CREATED' as WsMessageType:
        case 'QUOTE_UPDATED' as WsMessageType:
        case 'QUOTE_DELETED' as WsMessageType:
          scheduleInvalidation('quotes');
          break;

        // QC events
        case 'QC_CHECKLIST_CREATED' as WsMessageType:
        case 'QC_CHECKLIST_UPDATED' as WsMessageType:
        case 'QC_CHECKLIST_DELETED' as WsMessageType:
        case 'QC_INSPECTION_CREATED' as WsMessageType:
        case 'QC_INSPECTION_UPDATED' as WsMessageType:
        case 'QC_INSPECTION_DELETED' as WsMessageType:
          scheduleInvalidation('qc', 'qc-checklists', 'qc-inspections');
          break;

        // Customer/credit events
        case 'CUSTOMER_UPDATED' as WsMessageType:
        case 'CUSTOMER_CREDIT_UPDATED' as WsMessageType:
        case 'CUSTOMER_ON_HOLD' as WsMessageType:
        case 'CUSTOMER_RELEASED' as WsMessageType:
        case 'CREDIT_APPROVAL_REQUESTED' as WsMessageType:
        case 'CREDIT_APPROVAL_PROCESSED' as WsMessageType:
          scheduleInvalidation('customers', 'customer');
          break;

        // Installation events
        case 'INSTALL_JOB_CREATED' as WsMessageType:
        case 'INSTALL_JOB_UPDATED' as WsMessageType:
        case 'INSTALL_JOB_DELETED' as WsMessageType:
          scheduleInvalidation('install-jobs', 'installer-scheduling');
          break;

        // Material/cost events
        case 'MATERIAL_RECORDED' as WsMessageType:
        case 'MATERIAL_UPDATED' as WsMessageType:
        case 'MATERIAL_DELETED' as WsMessageType:
        case 'MATERIALS_BULK_ADDED' as WsMessageType:
        case 'JOB_COST_UPDATED' as WsMessageType:
          scheduleInvalidation('materials', 'job-costs', 'orders', 'dashboard');
          break;

        // Inventory events
        case 'INVENTORY_UPDATED' as WsMessageType:
          scheduleInvalidation('inventory', 'item-masters-list');
          break;

        // Customer interaction events
        case 'INTERACTION_CREATED' as WsMessageType:
        case 'INTERACTION_UPDATED' as WsMessageType:
        case 'INTERACTION_DELETED' as WsMessageType:
          scheduleInvalidation('interactions', 'customer');
          break;

        // Template events
        case 'TEMPLATE_CREATED' as WsMessageType:
        case 'TEMPLATE_UPDATED' as WsMessageType:
        case 'TEMPLATE_DELETED' as WsMessageType:
          scheduleInvalidation('templates');
          break;

        // Shipment events
        case 'SHIPMENT_CREATED' as WsMessageType:
        case 'SHIPMENT_UPDATED' as WsMessageType:
        case 'SHIPMENT_DELETED' as WsMessageType:
          scheduleInvalidation('shipments', 'orders', 'dashboard', 'shop-floor-orders');
          break;

        // Import events
        case 'IMPORT_COMPLETED' as WsMessageType:
          scheduleInvalidation('orders', 'dashboard', 'customers', 'item-masters-list');
          break;

        // Alert events
        case 'ALERT_CREATED' as WsMessageType:
        case 'ALERT_UPDATED' as WsMessageType:
        case 'ALERT_RESOLVED' as WsMessageType:
          scheduleInvalidation('alerts');
          break;

        case 'AUTHENTICATED':
          console.log('WebSocket authenticated successfully');
          break;
      }
    });

    // Connect if not already connected
    manager.connect();

    // Authenticate when connected
    const authData = localStorage.getItem('erp-auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        if (parsed?.state?.token) {
          // Small delay to ensure connection is fully established
          setTimeout(() => manager.authenticate(parsed.state.token), 100);
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Don't disconnect on unmount - we want persistent connection
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [queryClient]);

  return { status, lastMessage };
}
