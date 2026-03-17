import type { Request, Response, NextFunction } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { prisma } from '../db/client.js';
import { UnauthorizedError, ForbiddenError } from './error-handler.js';
import type { User, UserRole, PrintingMethod } from '@erp/shared';

export interface AuthRequest extends Request {
  user?: User;
  userId?: string;
}

interface JwtPayload {
  userId: string;
  username: string;
  role: UserRole;
}

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
}
const JWT_OPTIONS: SignOptions = {
  expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'],
};

export function generateToken(user: { id: string; username: string; role: string }): string {
  return jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    JWT_OPTIONS
  );
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;
}

export async function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  
  // Support token in query param (for image src URLs that can't set headers)
  const queryToken = req.query.token as string | undefined;

  let token: string | undefined;
  
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (queryToken) {
    token = queryToken;
  }
  
  if (!token) {
    throw UnauthorizedError('Missing or invalid authorization header');
  }

  try {
    const payload = verifyToken(token);
    
    // Reject portal tokens on internal API (defense in depth)
    if ((payload as any).type === 'portal') {
      throw UnauthorizedError('Portal tokens cannot access internal API');
    }
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive) {
      throw UnauthorizedError('User not found or inactive');
    }

    req.user = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role as UserRole,
      isActive: user.isActive,
      allowedStations: user.allowedStations as PrintingMethod[],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    req.userId = user.id;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw UnauthorizedError('Invalid token');
    }
    throw error;
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw UnauthorizedError();
    }

    if (!roles.includes(req.user.role)) {
      throw ForbiddenError('Insufficient permissions');
    }

    next();
  };
}

export function requireStation(...stations: PrintingMethod[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw UnauthorizedError();
    }

    // Admins and managers can access all stations
    if (req.user.role === 'ADMIN' || req.user.role === 'MANAGER') {
      next();
      return;
    }

    const hasAccess = stations.some((station) =>
      req.user?.allowedStations.includes(station)
    );

    if (!hasAccess) {
      throw ForbiddenError('Not authorized for this station');
    }

    next();
  };
}
