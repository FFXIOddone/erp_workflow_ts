import type { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { WebSocket, WebSocketServer } from 'ws';
import type { WsMessage } from '@erp/shared';
import { isOriginAllowed, parseAllowedOrigins } from '../lib/origin-allowlist.js';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

const clients = new Set<AuthenticatedWebSocket>();

export function setupWebSocket(wss: WebSocketServer): void {
  // Validate origin on WebSocket upgrade to prevent Cross-Site WebSocket Hijacking.
  // Also allow same-host browser connections even when users browse by machine name.
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGIN);
  wss.options.verifyClient = (
    info: { origin: string; req: IncomingMessage },
    callback: (result: boolean, code?: number, message?: string) => void
  ) => {
    const origin = info.origin || info.req.headers.origin || '';
    if (allowedOrigins.length === 0 || isOriginAllowed(origin, allowedOrigins, info.req.headers.host || '')) {
      callback(true);
      return;
    }

    console.warn(`WebSocket connection rejected from origin: ${origin}`);
    callback(false, 403, 'Origin not allowed');
  };

  wss.on('connection', (ws: AuthenticatedWebSocket) => {
    ws.isAlive = true;
    clients.add(ws);
    console.log(`WebSocket client connected (${clients.size} total)`);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message: Buffer) => {
      try {
        ws.isAlive = true;
        const data = JSON.parse(message.toString()) as { type: string; payload?: unknown };

        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date() }));
        }

        if (
          data.type === 'AUTHENTICATE' &&
          typeof data.payload === 'object' &&
          data.payload &&
          'token' in data.payload
        ) {
          const token = (data.payload as { token: string }).token;

          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
            if (ws.userId === decoded.userId) {
              return;
            }

            ws.userId = decoded.userId;
            ws.send(
              JSON.stringify({
                type: 'AUTHENTICATED',
                payload: { userId: decoded.userId },
                timestamp: new Date(),
              })
            );
            console.log(`WebSocket authenticated for user: ${decoded.userId}`);
          } catch {
            ws.send(
              JSON.stringify({
                type: 'AUTH_ERROR',
                payload: { message: 'Invalid token' },
                timestamp: new Date(),
              })
            );
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`WebSocket client disconnected (${clients.size} remaining)`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });

    ws.send(
      JSON.stringify({
        type: 'USER_JOINED',
        payload: { message: 'Connected to ERP WebSocket' },
        timestamp: new Date(),
      })
    );
  });

  // Use protocol-level ping/pong so browser tab throttling does not look like a dead client.
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedWebSocket;

      if (authWs.isAlive === false) {
        clients.delete(authWs);
        authWs.terminate();
        return;
      }

      authWs.isAlive = false;
      authWs.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });
}

interface BroadcastMessage<T> extends WsMessage<T> {
  targetUserId?: string;
}

export function broadcast<T>(message: BroadcastMessage<T>): void {
  const data = JSON.stringify(message);

  for (const client of clients) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }

    if (message.targetUserId) {
      if (client.userId === message.targetUserId) {
        client.send(data);
      }
      continue;
    }

    client.send(data);
  }
}

export function broadcastToUser<T>(userId: string, message: WsMessage<T>): void {
  const data = JSON.stringify(message);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN && client.userId === userId) {
      client.send(data);
    }
  }
}

export function getConnectedClients(): number {
  return clients.size;
}

export function getAuthenticatedClients(): number {
  let count = 0;

  for (const client of clients) {
    if (client.userId) {
      count++;
    }
  }

  return count;
}
