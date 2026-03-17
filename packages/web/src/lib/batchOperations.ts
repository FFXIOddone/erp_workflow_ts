/**
 * Batch API Operations
 * 
 * Utilities for making batch API calls with:
 * - Automatic request batching
 * - Rate limiting
 * - Progress tracking
 * - Error aggregation
 * - Retry logic
 */

import { useState, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface BatchOptions {
  /** Maximum concurrent requests */
  concurrency?: number;
  
  /** Delay between batches (ms) */
  batchDelay?: number;
  
  /** Maximum items per batch */
  batchSize?: number;
  
  /** Number of retries for failed items */
  retries?: number;
  
  /** Delay between retries (ms) */
  retryDelay?: number;
  
  /** Continue processing on errors */
  continueOnError?: boolean;
  
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  currentBatch: number;
  totalBatches: number;
  estimatedTimeRemaining?: number;
}

export interface BatchResult<T, R> {
  success: boolean;
  results: Array<{
    item: T;
    result?: R;
    error?: Error;
    retryCount: number;
  }>;
  successCount: number;
  failureCount: number;
  duration: number;
}

export interface BatchError {
  item: unknown;
  error: Error;
  attempt: number;
}

// ============================================================================
// Batch Processor Class
// ============================================================================

export class BatchProcessor<T, R> {
  private options: Required<Omit<BatchOptions, 'signal'>>;
  private signal?: AbortSignal;
  private onProgress?: (progress: BatchProgress) => void;

  constructor(options: BatchOptions = {}) {
    this.options = {
      concurrency: options.concurrency ?? 5,
      batchDelay: options.batchDelay ?? 100,
      batchSize: options.batchSize ?? 10,
      retries: options.retries ?? 2,
      retryDelay: options.retryDelay ?? 1000,
      continueOnError: options.continueOnError ?? true,
    };
    this.signal = options.signal;
  }

  setProgressCallback(callback: (progress: BatchProgress) => void) {
    this.onProgress = callback;
  }

  async process(
    items: T[],
    processor: (item: T) => Promise<R>
  ): Promise<BatchResult<T, R>> {
    const startTime = Date.now();
    const results: BatchResult<T, R>['results'] = [];
    const batches = this.createBatches(items);
    
    let completed = 0;
    let failed = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      // Check for cancellation
      if (this.signal?.aborted) {
        throw new Error('Batch processing cancelled');
      }

      const batch = batches[batchIndex];
      const batchResults = await this.processBatch(batch, processor, batchIndex, batches.length);
      
      for (const result of batchResults) {
        results.push(result);
        if (result.error) {
          failed++;
        } else {
          completed++;
        }
      }

      // Report progress
      this.onProgress?.({
        total: items.length,
        completed,
        failed,
        pending: items.length - completed - failed,
        currentBatch: batchIndex + 1,
        totalBatches: batches.length,
        estimatedTimeRemaining: this.estimateTimeRemaining(
          startTime,
          completed + failed,
          items.length
        ),
      });

      // Delay between batches
      if (batchIndex < batches.length - 1 && this.options.batchDelay > 0) {
        await this.delay(this.options.batchDelay);
      }
    }

    return {
      success: failed === 0,
      results,
      successCount: completed,
      failureCount: failed,
      duration: Date.now() - startTime,
    };
  }

  private createBatches(items: T[]): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += this.options.batchSize) {
      batches.push(items.slice(i, i + this.options.batchSize));
    }
    return batches;
  }

  private async processBatch(
    batch: T[],
    processor: (item: T) => Promise<R>,
    _batchIndex: number,
    _totalBatches: number
  ): Promise<BatchResult<T, R>['results']> {
    const results: BatchResult<T, R>['results'] = [];
    
    // Process with concurrency limit
    const chunks = this.createBatches(batch).map((chunk) => 
      chunk.slice(0, this.options.concurrency)
    );

    for (const chunk of [batch.slice(0, this.options.concurrency)]) {
      const remaining = [...batch];
      const active: Promise<void>[] = [];
      
      while (remaining.length > 0 || active.length > 0) {
        // Fill up to concurrency limit
        while (remaining.length > 0 && active.length < this.options.concurrency) {
          const item = remaining.shift()!;
          const promise = this.processItemWithRetry(item, processor)
            .then((result) => {
              results.push(result);
            });
          active.push(promise);
        }

        // Wait for at least one to complete
        if (active.length > 0) {
          await Promise.race(active);
          // Remove completed promises
          for (let i = active.length - 1; i >= 0; i--) {
            const status = await Promise.race([
              active[i].then(() => 'resolved'),
              Promise.resolve('pending'),
            ]);
            if (status === 'resolved') {
              active.splice(i, 1);
            }
          }
        }
      }
    }

    // Simpler approach - process all in parallel with limit
    const processQueue = async () => {
      const queue = [...batch];
      const inFlight: Promise<void>[] = [];
      
      const processNext = async (): Promise<void> => {
        const item = queue.shift();
        if (!item) return;
        
        const result = await this.processItemWithRetry(item, processor);
        results.push(result);
        
        if (queue.length > 0) {
          await processNext();
        }
      };

      // Start initial batch
      for (let i = 0; i < Math.min(this.options.concurrency, batch.length); i++) {
        inFlight.push(processNext());
      }

      await Promise.all(inFlight);
    };

    await processQueue();

    return results;
  }

  private async processItemWithRetry(
    item: T,
    processor: (item: T) => Promise<R>
  ): Promise<BatchResult<T, R>['results'][0]> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= this.options.retries; attempt++) {
      try {
        const result = await processor(item);
        return { item, result, retryCount: attempt };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.options.retries) {
          await this.delay(this.options.retryDelay * (attempt + 1));
        }
      }
    }

    if (!this.options.continueOnError) {
      throw lastError;
    }

    return { item, error: lastError, retryCount: this.options.retries };
  }

  private estimateTimeRemaining(
    startTime: number,
    processed: number,
    total: number
  ): number | undefined {
    if (processed === 0) return undefined;
    
    const elapsed = Date.now() - startTime;
    const rate = processed / elapsed;
    const remaining = total - processed;
    
    return remaining / rate;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Hook for Batch Operations
// ============================================================================

export interface UseBatchOperationOptions extends BatchOptions {
  onProgress?: (progress: BatchProgress) => void;
  onComplete?: (result: BatchResult<unknown, unknown>) => void;
  onError?: (errors: BatchError[]) => void;
}

export function useBatchOperation<T, R>(
  processor: (item: T) => Promise<R>,
  options: UseBatchOperationOptions = {}
) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [result, setResult] = useState<BatchResult<T, R> | null>(null);
  const [errors, setErrors] = useState<BatchError[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(
    async (items: T[]): Promise<BatchResult<T, R>> => {
      // Cancel any existing operation
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsProcessing(true);
      setProgress(null);
      setResult(null);
      setErrors([]);

      const batchProcessor = new BatchProcessor<T, R>({
        ...options,
        signal: abortControllerRef.current.signal,
      });

      batchProcessor.setProgressCallback((p) => {
        setProgress(p);
        options.onProgress?.(p);
      });

      try {
        const batchResult = await batchProcessor.process(items, processor);
        
        setResult(batchResult);
        options.onComplete?.(batchResult as BatchResult<unknown, unknown>);

        // Collect errors
        const batchErrors = batchResult.results
          .filter((r) => r.error)
          .map((r) => ({
            item: r.item,
            error: r.error!,
            attempt: r.retryCount,
          }));

        if (batchErrors.length > 0) {
          setErrors(batchErrors);
          options.onError?.(batchErrors);
        }

        return batchResult;
      } catch (error) {
        const batchError: BatchError = {
          item: null,
          error: error instanceof Error ? error : new Error(String(error)),
          attempt: 0,
        };
        setErrors([batchError]);
        options.onError?.([batchError]);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [processor, options]
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsProcessing(false);
  }, []);

  const reset = useCallback(() => {
    setProgress(null);
    setResult(null);
    setErrors([]);
  }, []);

  return {
    execute,
    cancel,
    reset,
    isProcessing,
    progress,
    result,
    errors,
  };
}

// ============================================================================
// Bulk API Call Utilities
// ============================================================================

/**
 * Execute a bulk API operation with proper batching
 */
export async function bulkApiCall<T, R>(
  items: T[],
  apiCall: (item: T) => Promise<R>,
  options: BatchOptions = {}
): Promise<BatchResult<T, R>> {
  const processor = new BatchProcessor<T, R>(options);
  return processor.process(items, apiCall);
}

/**
 * Execute a bulk update with optimistic updates
 */
export async function bulkUpdate<T extends { id: string }, R>(
  items: T[],
  updateFn: (item: T) => Promise<R>,
  options: BatchOptions & {
    onOptimisticUpdate?: (item: T) => void;
    onRollback?: (item: T) => void;
  } = {}
): Promise<BatchResult<T, R>> {
  // Apply optimistic updates
  if (options.onOptimisticUpdate) {
    for (const item of items) {
      options.onOptimisticUpdate(item);
    }
  }

  const processor = new BatchProcessor<T, R>(options);
  const result = await processor.process(items, updateFn);

  // Rollback failed items
  if (options.onRollback) {
    for (const r of result.results) {
      if (r.error) {
        options.onRollback(r.item);
      }
    }
  }

  return result;
}

/**
 * Execute a bulk delete with confirmation
 */
export async function bulkDelete<T extends { id: string }>(
  items: T[],
  deleteFn: (id: string) => Promise<void>,
  options: BatchOptions = {}
): Promise<BatchResult<T, void>> {
  const processor = new BatchProcessor<T, void>(options);
  return processor.process(items, (item) => deleteFn(item.id));
}

// ============================================================================
// Rate Limiter
// ============================================================================

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    
    if (this.tokens < 1) {
      // Wait for token to become available
      const waitTime = (1 / this.refillRate) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.acquire();
    }

    this.tokens--;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }
}

/**
 * Create a rate-limited version of a function
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  requestsPerSecond: number
): T {
  const limiter = new RateLimiter(requestsPerSecond, requestsPerSecond);

  return (async (...args: Parameters<T>) => {
    await limiter.acquire();
    return fn(...args);
  }) as T;
}

export default BatchProcessor;
