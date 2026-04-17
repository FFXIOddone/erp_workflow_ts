import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useAuthStore } from '../stores/auth';
import { useConfigStore } from '../stores/config';
import {
  disconnectShopFloorWebSocket,
  getShopFloorWebSocketManager,
  type MessageHandler,
  type WsStatus,
} from './websocket-manager';

export type { WsStatus };

/**
 * Returns WebSocket connection status, a subscribe-to-messages helper,
 * and a send function. The underlying socket stays alive across station
 * remounts and only disconnects on explicit logout.
 */
export function useWebSocket(onMessage?: MessageHandler) {
  const { config } = useConfigStore();
  const { token } = useAuthStore();
  const managerRef = useRef(getShopFloorWebSocketManager());
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const status = useSyncExternalStore(
    (callback) => managerRef.current.subscribeStatus(callback),
    () => managerRef.current.getStatus(),
  );

  useEffect(() => {
    const manager = managerRef.current;

    if (token) {
      manager.connect(token, config.apiUrl);
    } else {
      disconnectShopFloorWebSocket();
    }

    const unsubscribe = onMessage
      ? manager.subscribeMessages((message) => {
          onMessageRef.current?.(message);
        })
      : undefined;

    return () => {
      unsubscribe?.();
    };
  }, [config.apiUrl, onMessage, token]);

  const subscribe = useCallback(
    (handler: MessageHandler) => managerRef.current.subscribeMessages(handler),
    [],
  );

  const send = useCallback((msg: { type: string; payload?: unknown; timestamp?: string }) => {
    managerRef.current.send(msg);
  }, []);

  return { status, subscribe, send };
}
