/**
 * Enhanced WebSocket hook for the Shop Floor app.
 * Features: auto-reconnect with exponential backoff, PING/PONG keepalive,
 * message subscriptions, and connection health monitoring.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useConfigStore } from '../stores/config';
import { useAuthStore } from '../stores/auth';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

interface WsMessage {
  type: string;
  payload?: unknown;
  timestamp?: string;
}

type MessageHandler = (msg: WsMessage) => void;

/**
 * Returns WebSocket connection status, a subscribe-to-messages helper,
 * and a send function. Automatically reconnects with exponential backoff.
 */
export function useWebSocket(onMessage?: MessageHandler) {
  const { config } = useConfigStore();
  const { token } = useAuthStore();
  const [status, setStatus] = useState<WsStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onMessageRef = useRef(onMessage);
  const subscribersRef = useRef<Set<MessageHandler>>(new Set());
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!token) return;

    // Derive WS URL from API URL: http->ws, /api/v1->/ws
    const wsUrl = config.apiUrl
      .replace(/^http/, 'ws')
      .replace(/\/api\/v1\/?$/, '/ws');

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setStatus('connecting');

      ws.onopen = () => {
        setStatus('connected');
        attemptsRef.current = 0;
        // Authenticate
        ws.send(JSON.stringify({ type: 'AUTHENTICATE', payload: { token } }));

        // Start keepalive ping every 25 seconds
        if (pingRef.current) clearInterval(pingRef.current);
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 25000);
      };

      ws.onmessage = (ev) => {
        try {
          const msg: WsMessage = JSON.parse(ev.data);
          // Notify main handler
          onMessageRef.current?.(msg);
          // Notify all subscribers
          for (const handler of subscribersRef.current) {
            try { handler(msg); } catch {}
          }
        } catch {
          // Ignore non-JSON frames
        }
      };

      ws.onclose = () => {
        setStatus('disconnected');
        wsRef.current = null;
        if (pingRef.current) clearInterval(pingRef.current);
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      scheduleReconnect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, config.apiUrl]);

  const scheduleReconnect = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const delay = Math.min(1000 * 2 ** attemptsRef.current, 30000);
    attemptsRef.current++;
    timerRef.current = setTimeout(connect, delay);
  }, [connect]);

  // Subscribe to messages
  const subscribe = useCallback((handler: MessageHandler) => {
    subscribersRef.current.add(handler);
    return () => {
      subscribersRef.current.delete(handler);
    };
  }, []);

  // Send a message
  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return { status, subscribe, send };
}
