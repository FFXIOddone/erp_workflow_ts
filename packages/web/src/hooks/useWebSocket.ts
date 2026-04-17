import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { WsMessageType, type WsMessage } from '@erp/shared';
import { disconnectWebSocket, getWebSocketManager, type ConnectionStatus } from '../lib/websocket-manager';

interface OrderPayload {
  orderNumber?: string;
  station?: string;
  workOrderId?: string;
  orderId?: string;
}

export function useWebSocket() {
  const queryClient = useQueryClient();
  const managerRef = useRef(getWebSocketManager());
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
      const invalidateOrder = () => {
        // Keep the whole order family fresh because the detail page, linked
        // data, file chain, and timeline all fan out from the same record.
        scheduleInvalidation('orders', 'dashboard', 'shop-floor-orders', 'order-entry-orders', 'equipment-activity');
      };

      const invalidateOrderDetailAndFileChain = (workOrderId: string) => {
        scheduleInvalidation('file-chain', 'orders', 'equipment-activity');
        void queryClient.invalidateQueries({ queryKey: ['file-chain', workOrderId] });
        void queryClient.invalidateQueries({ queryKey: ['orders', workOrderId] });
        void queryClient.invalidateQueries({ queryKey: ['orders', workOrderId, 'linked-data'] });
      };

      switch (message.type) {
        case 'ORDER_CREATED' as WsMessageType:
          invalidateOrder();
          if (message.payload?.orderNumber) {
            toast.success(`New order #${message.payload.orderNumber} created`, {
              icon: '📋',
              duration: 4000,
            });
          }
          break;
        case 'ORDER_UPDATED' as WsMessageType:
          invalidateOrder();
          break;
        case 'ORDER_DELETED' as WsMessageType:
          invalidateOrder();
          break;
        case WsMessageType.FILE_CHAIN_UPDATED: {
          const fileChainPayload = message.payload as { workOrderId?: string; orderId?: string } | undefined;
          const workOrderId = fileChainPayload?.workOrderId ?? fileChainPayload?.orderId ?? null;
          if (workOrderId) {
            invalidateOrderDetailAndFileChain(workOrderId);
          }
          break;
        }
        case 'STATION_UPDATED' as WsMessageType:
          invalidateOrder();
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
          scheduleInvalidation('print-queue', 'orders', 'equipment-activity');
          break;
        case 'PRINT_JOB_STATUS_CHANGED' as WsMessageType: {
          scheduleInvalidation('print-queue', 'orders', 'equipment-activity');
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
          scheduleInvalidation('print-queue', 'equipment-activity');
          break;
        case 'RIP_JOB_CREATED' as WsMessageType:
        case 'RIP_JOB_UPDATED' as WsMessageType:
        case 'RIP_JOB_DELETED' as WsMessageType:
        case 'RIP_JOB_STATUS_SYNC' as WsMessageType:
          scheduleInvalidation('rip-queue', 'orders', 'equipment-activity');
          break;
        case 'RIP_JOB_STATUS_CHANGED' as WsMessageType: {
          scheduleInvalidation('rip-queue', 'orders', 'equipment-activity');
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
        case 'EQUIPMENT_REPAIRED' as WsMessageType:
        case 'EQUIPMENT_STATUS_CHANGED' as WsMessageType:
        case 'EQUIPMENT_DELETED' as WsMessageType:
        case 'EQUIPMENT_DOWN' as WsMessageType:
        case 'EQUIPMENT_RESTORED' as WsMessageType:
          scheduleInvalidation('equipment', 'equipment-status', 'equipment-live-status', 'equipment-activity');
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
          scheduleInvalidation('shipments', 'orders', 'dashboard', 'shop-floor-orders', 'equipment-activity');
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
      manager.setMessageHandler(null);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [queryClient]);

  return { status, lastMessage };
}

export { disconnectWebSocket };
export type { ConnectionStatus };
