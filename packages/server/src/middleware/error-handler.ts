import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'logs');
const ERROR_LOG = path.join(LOG_DIR, 'api-errors.log');

// Ensure logs directory exists
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch { /* ok */ }

/** Append a structured error entry to the log file */
function logErrorToFile(req: Request, statusCode: number, error: string, details?: unknown) {
  const entry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    status: statusCode,
    error,
    details: details ?? undefined,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };
  const line = JSON.stringify(entry) + '\n';
  fs.appendFile(ERROR_LOG, line, () => { /* fire and forget */ });
}

export interface ApiError extends Error {
  statusCode?: number;
  details?: unknown;
}

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isRoutineClientError = statusCode >= 400 && statusCode < 500;

  if (!isRoutineClientError) {
    console.error('Error:', err);
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    logErrorToFile(_req, 400, 'Validation Error', err.errors);
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.errors,
    });
    return;
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        logErrorToFile(_req, 409, 'Duplicate record', err.meta);
        res.status(409).json({
          success: false,
          error: 'A record with this value already exists',
          details: err.meta,
        });
        return;
      case 'P2025':
        logErrorToFile(_req, 404, 'Record not found');
        res.status(404).json({
          success: false,
          error: 'Record not found',
        });
        return;
      default:
        logErrorToFile(_req, 400, `Prisma ${err.code}: ${err.message}`);
        res.status(400).json({
          success: false,
          error: 'Database error',
          // Don't leak Prisma internals to client
        });
        return;
    }
  }

  // Prisma validation errors (bad query shape — like unknown field in select)
  if (err instanceof Prisma.PrismaClientValidationError) {
    logErrorToFile(_req, 500, `Prisma validation: ${err.message.substring(0, 500)}`);
    res.status(500).json({
      success: false,
      error: 'An internal error occurred',
      // Don't leak Prisma internals to client
    });
    return;
  }

  // Custom API errors
  logErrorToFile(_req, statusCode, err.message ?? 'Internal Server Error', err.details);
  res.status(statusCode).json({
    success: false,
    error: err.message ?? 'Internal Server Error',
    details: err.details,
  });
}

export class HttpError extends Error implements ApiError {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'HttpError';
  }
}

export const NotFoundError = (message = 'Not Found'): HttpError => new HttpError(404, message);
export const BadRequestError = (message: string, details?: unknown): HttpError => new HttpError(400, message, details);
export const UnauthorizedError = (message = 'Unauthorized'): HttpError => new HttpError(401, message);
export const ForbiddenError = (message = 'Forbidden'): HttpError => new HttpError(403, message);
export const ConflictError = (message: string): HttpError => new HttpError(409, message);
