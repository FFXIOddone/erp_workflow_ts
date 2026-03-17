/**
 * Simple Background Job Queue
 * 
 * Provides an in-memory job queue for background task processing.
 * For production with multiple servers, consider Redis-based queue (Bull, BullMQ).
 * Part of Critical Improvement #8: Background Job Processing System
 * 
 * Usage:
 *   import { jobQueue, JobPriority } from '../lib/job-queue.js';
 *   
 *   // Register a job handler
 *   jobQueue.register('email:send', async (data) => {
 *     await sendEmail(data.to, data.subject, data.body);
 *   });
 *   
 *   // Add a job
 *   await jobQueue.add('email:send', { to: 'user@example.com', subject: 'Hello' });
 *   
 *   // Add with options
 *   await jobQueue.add('report:generate', { type: 'monthly' }, { 
 *     priority: JobPriority.LOW,
 *     delay: 60000, // 1 minute delay
 *     retries: 3,
 *   });
 */

import { createChildLogger } from './logger.js';

const logger = createChildLogger('job-queue');

// ============================================================================
// Types
// ============================================================================

export enum JobPriority {
  HIGH = 1,
  NORMAL = 5,
  LOW = 10,
}

export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

export interface Job<T = unknown> {
  id: string;
  type: string;
  data: T;
  status: JobStatus;
  priority: JobPriority;
  attempts: number;
  maxRetries: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  runAt?: Date; // For delayed jobs
}

export interface JobOptions {
  priority?: JobPriority;
  delay?: number; // milliseconds
  retries?: number;
}

export type JobHandler<T = unknown> = (data: T, job: Job<T>) => Promise<void>;

interface JobQueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  averageProcessingTime: number;
}

// ============================================================================
// Job Queue Implementation
// ============================================================================

class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private handlers: Map<string, JobHandler> = new Map();
  private processing = false;
  private processInterval: NodeJS.Timeout | null = null;
  private concurrency = 3;
  private activeJobs = 0;
  
  // Statistics
  private stats = {
    totalProcessed: 0,
    totalProcessingTime: 0,
    completed: 0,
    failed: 0,
  };

  /**
   * Register a job handler for a specific job type
   */
  register<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler);
    logger.info(`Registered handler for job type: ${type}`);
  }

  /**
   * Add a job to the queue
   */
  async add<T>(type: string, data: T, options: JobOptions = {}): Promise<string> {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const job: Job<T> = {
      id,
      type,
      data,
      status: JobStatus.PENDING,
      priority: options.priority ?? JobPriority.NORMAL,
      attempts: 0,
      maxRetries: options.retries ?? 0,
      createdAt: new Date(),
      runAt: options.delay ? new Date(Date.now() + options.delay) : undefined,
    };

    this.jobs.set(id, job as Job);
    logger.debug(`Added job ${id} of type ${type}`, { priority: job.priority });
    
    // Trigger processing if not already running
    this.scheduleProcessing();
    
    return id;
  }

  /**
   * Get job by ID
   */
  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  /**
   * Get all jobs of a specific status
   */
  getJobsByStatus(status: JobStatus): Job[] {
    return Array.from(this.jobs.values()).filter(job => job.status === status);
  }

  /**
   * Get queue statistics
   */
  getStats(): JobQueueStats {
    const pending = this.getJobsByStatus(JobStatus.PENDING).length;
    const running = this.getJobsByStatus(JobStatus.RUNNING).length;
    
    return {
      pending,
      running,
      completed: this.stats.completed,
      failed: this.stats.failed,
      totalProcessed: this.stats.totalProcessed,
      averageProcessingTime: this.stats.totalProcessed > 0 
        ? Math.round(this.stats.totalProcessingTime / this.stats.totalProcessed)
        : 0,
    };
  }

  /**
   * Start the job processor
   */
  start(intervalMs = 1000): void {
    if (this.processInterval) return;
    
    this.processing = true;
    this.processInterval = setInterval(() => this.processJobs(), intervalMs);
    logger.info('Job queue processor started');
  }

  /**
   * Stop the job processor
   */
  stop(): void {
    this.processing = false;
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    logger.info('Job queue processor stopped');
  }

  /**
   * Clear completed/failed jobs older than specified age
   */
  cleanup(maxAgeMs = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    
    for (const [id, job] of this.jobs.entries()) {
      if (
        (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) &&
        job.completedAt &&
        job.completedAt.getTime() < cutoff
      ) {
        this.jobs.delete(id);
        removed++;
      }
    }
    
    if (removed > 0) {
      logger.info(`Cleaned up ${removed} old jobs`);
    }
    
    return removed;
  }

  /**
   * Schedule processing (debounced)
   */
  private scheduleProcessing(): void {
    if (!this.processing) {
      this.start();
    }
  }

  /**
   * Process pending jobs
   */
  private async processJobs(): Promise<void> {
    if (this.activeJobs >= this.concurrency) return;

    // Get next job to process
    const pendingJobs = Array.from(this.jobs.values())
      .filter(job => {
        if (job.status !== JobStatus.PENDING && job.status !== JobStatus.RETRYING) {
          return false;
        }
        // Check if delayed job is ready
        if (job.runAt && job.runAt.getTime() > Date.now()) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.priority - b.priority); // Lower priority number = higher priority

    const job = pendingJobs[0];
    if (!job) return;

    const handler = this.handlers.get(job.type);
    if (!handler) {
      logger.warn(`No handler registered for job type: ${job.type}`);
      job.status = JobStatus.FAILED;
      job.error = `No handler registered for job type: ${job.type}`;
      job.completedAt = new Date();
      return;
    }

    // Process the job
    await this.executeJob(job, handler);
  }

  /**
   * Execute a single job
   */
  private async executeJob(job: Job, handler: JobHandler): Promise<void> {
    this.activeJobs++;
    job.status = JobStatus.RUNNING;
    job.startedAt = new Date();
    job.attempts++;

    try {
      await handler(job.data, job);
      
      job.status = JobStatus.COMPLETED;
      job.completedAt = new Date();
      
      const processingTime = job.completedAt.getTime() - job.startedAt.getTime();
      this.stats.totalProcessed++;
      this.stats.totalProcessingTime += processingTime;
      this.stats.completed++;
      
      logger.info(`Job ${job.id} completed`, { duration: processingTime });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (job.attempts < job.maxRetries + 1) {
        job.status = JobStatus.RETRYING;
        job.runAt = new Date(Date.now() + Math.pow(2, job.attempts) * 1000); // Exponential backoff
        logger.warn(`Job ${job.id} failed, retrying (attempt ${job.attempts}/${job.maxRetries + 1})`, { error: errorMessage });
      } else {
        job.status = JobStatus.FAILED;
        job.error = errorMessage;
        job.completedAt = new Date();
        this.stats.failed++;
        logger.error(`Job ${job.id} failed permanently`, { error: errorMessage, attempts: job.attempts });
      }
    } finally {
      this.activeJobs--;
    }
  }
}

// Export singleton instance
export const jobQueue = new JobQueue();

// ============================================================================
// Pre-defined Job Types
// ============================================================================

/**
 * Common job type constants
 */
export const JobTypes = {
  EMAIL_SEND: 'email:send',
  EMAIL_QUEUE_PROCESS: 'email:queue-process',
  REPORT_GENERATE: 'report:generate',
  ORDER_SYNC: 'order:sync',
  WOOCOMMERCE_SYNC: 'woocommerce:sync',
  CLEANUP_OLD_FILES: 'cleanup:old-files',
  CLEANUP_OLD_SESSIONS: 'cleanup:old-sessions',
  NOTIFICATION_SEND: 'notification:send',
  WEBHOOK_DISPATCH: 'webhook:dispatch',
} as const;

export default jobQueue;
