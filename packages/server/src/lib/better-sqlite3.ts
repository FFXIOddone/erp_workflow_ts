import type BetterSqlite3 from 'better-sqlite3';

type BetterSqlite3Constructor = typeof BetterSqlite3;

let betterSqlite3Promise: Promise<BetterSqlite3Constructor | null> | null = null;
let betterSqlite3LoadError: Error | null = null;
let betterSqlite3Warned = false;

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

function buildDegradedMessage(error?: unknown): string {
  const message = normalizeError(error ?? betterSqlite3LoadError ?? 'Unknown error').message.trim();
  return `${message} Node ${process.version} ABI ${process.versions.modules}.`;
}

export class BetterSqlite3UnavailableError extends Error {
  constructor(message?: string) {
    super(message ?? 'better-sqlite3 is unavailable for the current Node runtime');
    this.name = 'BetterSqlite3UnavailableError';
  }
}

export async function loadBetterSqlite3(context = 'SQLite'): Promise<BetterSqlite3Constructor | null> {
  if (!betterSqlite3Promise) {
    betterSqlite3Promise = import('better-sqlite3')
      .then((module) => module.default)
      .catch((error) => {
        betterSqlite3LoadError = normalizeError(error);
        return null;
      });
  }

  const Database = await betterSqlite3Promise;
  if (!Database) {
    warnBetterSqlite3UnavailableOnce(context, betterSqlite3LoadError);
  }

  return Database;
}

export async function requireBetterSqlite3(
  context = 'SQLite'
): Promise<BetterSqlite3Constructor> {
  const Database = await loadBetterSqlite3(context);
  if (Database) {
    return Database;
  }

  throw new BetterSqlite3UnavailableError(buildDegradedMessage());
}

export function warnBetterSqlite3UnavailableOnce(context: string, error?: unknown): void {
  if (betterSqlite3Warned) return;
  betterSqlite3Warned = true;
  console.warn(
    `[${context}] better-sqlite3 is unavailable, so SQLite-backed Zund features are running in degraded mode. ${buildDegradedMessage(error)} Re-run npm rebuild better-sqlite3 with this Node version to restore them.`
  );
}

export function isBetterSqlite3UnavailableError(
  error: unknown
): error is BetterSqlite3UnavailableError {
  return error instanceof BetterSqlite3UnavailableError;
}
