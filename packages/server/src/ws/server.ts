import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import type { WsMessage } from '@erp/shared';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

const clients = new Set<AuthenticatedWebSocket>();

export function setupWebSocket(wss: WebSocketServer): void {
  // Validate origin on WebSocket upgrade to prevent Cross-Site WebSocket Hijacking
  const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);
  const lanPattern = /^https?:\/\/192\.168\.254\.\d{1,3}(:\d+)?$/;

  wss.options.verifyClient = (info: { origin: string; req: IncomingMessage }, callback: (result: boolean, code?: number, message?: string) => void) => {
    const origin = info.origin || info.req.headers.origin || '';
    // Allow connections with no origin (non-browser clients like desktop apps)
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin) || lanPattern.test(origin)) {
      callback(true);
    } else {
      console.warn(`📡 WebSocket connection rejected from origin: ${origin}`);
      callback(false, 403, 'Origin not allowed');
    }
  };

  wss.on('connection', (ws: AuthenticatedWebSocket) => {
    ws.isAlive = true;
    clients.add(ws);
    console.log(`📡 WebSocket client connected (${clients.size} total)`);

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString()) as { type: string; payload?: unknown };
        
        if (data.type === 'PING') {
          ws.isAlive = true;
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date() }));
        }
        
        // Handle authentication message to associate userId with connection
        if (data.type === 'AUTHENTICATE' && typeof data.payload === 'object' && data.payload && 'token' in data.payload) {
          const token = (data.payload as { token: string }).token;
          try {
            const decoded = jwt.verify(
              token,
              process.env.JWT_SECRET!
            ) as { userId: string };
            ws.userId = decoded.userId;
            ws.send(JSON.stringify({ 
              type: 'AUTHENTICATED', 
              payload: { userId: decoded.userId },
              timestamp: new Date() 
            }));
            console.log(`📡 WebSocket authenticated for user: ${decoded.userId}`);
          } catch {
            ws.send(JSON.stringify({ 
              type: 'AUTH_ERROR', 
              payload: { message: 'Invalid token' },
              timestamp: new Date() 
            }));
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`📡 WebSocket client disconnected (${clients.size} remaining)`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'USER_JOINED',
      payload: { message: 'Connected to ERP WebSocket' },
      timestamp: new Date(),
    }));
  });

  // Heartbeat to detect stale connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedWebSocket;
      if (authWs.isAlive === false) {
        clients.delete(authWs);
        return authWs.terminate();
      }
      authWs.isAlive = false;
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });
}

interface BroadcastMessage<T> extends WsMessage<T> {
  targetUserId?: string; // If set, only send to this user
}

export function broadcast<T>(message: BroadcastMessage<T>): void {
  const data = JSON.stringify(message);
  
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      // If targetUserId is specified, only send to that user
      if (message.targetUserId) {
        if (client.userId === message.targetUserId) {
          client.send(data);
        }
      } else {
        client.send(data);
      }
    }
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
    if (client.userId) count++;
  }
  return count;
}
