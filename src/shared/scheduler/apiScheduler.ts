/**
 * Okta API Scheduler
 *
 * Centralized scheduler for all Okta API requests. Prevents rate limiting by:
 * - Queuing requests with priority levels
 * - Tracking rate limit headers
 * - Implementing intelligent backoff and cooldown
 * - Controlling concurrency
 * - Auto-retrying failed requests
 *
 * This scheduler runs in the background service worker and coordinates ALL
 * Okta API calls across the entire extension.
 */

import { RateLimitDetector } from './rateLimitDetector';
import type {
  QueuedRequest,
  RequestPriority,
  SchedulerStatus,
  SchedulerConfig,
  SchedulerState,
  SchedulerMetrics,
  RequestResult,
  RateLimitInfo,
} from './types';

const DEFAULT_CONFIG: SchedulerConfig = {
  maxConcurrent: 3, // Conservative: max 3 parallel requests
  minRemainingThreshold: 10, // Cooldown when <10% remaining
  cooldownDuration: 60000, // 60 seconds cooldown
  retryDelay: 2000, // 2 second base retry delay
  maxRetries: 3, // Retry up to 3 times
  requestTimeout: 30000, // 30 second timeout per request
};

export class ApiScheduler {
  private queue: QueuedRequest[] = [];
  private activeRequests: Map<string, QueuedRequest> = new Map();
  private rateLimitDetector: RateLimitDetector;
  private config: SchedulerConfig;
  private status: SchedulerStatus = 'idle';
  private cooldownEndsAt: number | null = null;
  private isPaused: boolean = false;
  private processingInterval: ReturnType<typeof setInterval> | null = null;

  // Metrics
  private metrics: SchedulerMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retriedRequests: 0,
    cacheHits: 0,
    averageWaitTime: 0,
    averageExecutionTime: 0,
    cooldownEvents: 0,
    throttleEvents: 0,
  };

  private lastError: string | null = null;
  private stateListeners: Set<(state: SchedulerState) => void> = new Set();

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rateLimitDetector = new RateLimitDetector();

    console.log('[ApiScheduler] Initialized with config:', this.config);

    // Start processing loop
    this.startProcessing();
  }

  /**
   * Schedule an API request
   */
  async scheduleRequest(
    endpoint: string,
    method: string,
    body: any | undefined,
    tabId: number,
    priority: RequestPriority = 'normal'
  ): Promise<RequestResult> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: this.generateRequestId(),
        endpoint,
        method,
        body,
        priority,
        tabId,
        timestamp: Date.now(),
        resolve: (result: RequestResult) => resolve(result),
        reject,
        retryCount: 0,
        maxRetries: this.config.maxRetries,
      };

      this.addToQueue(request);
      this.metrics.totalRequests++;
      this.notifyStateChange();

      console.log('[ApiScheduler] Scheduled request:', {
        id: request.id,
        endpoint,
        method,
        priority,
        queueLength: this.queue.length,
      });
    });
  }

  /**
   * Add request to queue with priority ordering
   */
  private addToQueue(request: QueuedRequest): void {
    // Insert based on priority (high > normal > low)
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    const requestPriorityValue = priorityOrder[request.priority];

    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (priorityOrder[this.queue[i].priority] > requestPriorityValue) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, request);
  }

  /**
   * Start the processing loop
   */
  private startProcessing(): void {
    if (this.processingInterval) return;

    // Process queue every 100ms
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 100);

    console.log('[ApiScheduler] Started processing loop');
  }

  /**
   * Stop the processing loop
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    console.log('[ApiScheduler] Stopped processing loop');
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    // Skip if paused
    if (this.isPaused) {
      this.updateStatus('paused');
      return;
    }

    // Check cooldown
    if (this.cooldownEndsAt && Date.now() < this.cooldownEndsAt) {
      this.updateStatus('cooldown');
      return;
    } else if (this.cooldownEndsAt) {
      // Cooldown ended
      console.log('[ApiScheduler] Cooldown ended, resuming processing');
      this.cooldownEndsAt = null;
    }

    // Check if we can process more requests
    if (this.activeRequests.size >= this.config.maxConcurrent) {
      this.updateStatus('processing');
      return;
    }

    // Check rate limits
    if (this.rateLimitDetector.isApproachingLimit(this.config.minRemainingThreshold)) {
      this.enterCooldown();
      return;
    }

    // Get next request from queue
    const request = this.queue.shift();
    if (!request) {
      this.updateStatus('idle');
      return;
    }

    // Execute request
    this.updateStatus('processing');
    this.executeRequest(request);
  }

  /**
   * Execute a single request
   */
  private async executeRequest(request: QueuedRequest): Promise<void> {
    this.activeRequests.set(request.id, request);
    const startTime = Date.now();

    try {
      console.log('[ApiScheduler] Executing request:', {
        id: request.id,
        endpoint: request.endpoint,
        method: request.method,
        attempt: request.retryCount + 1,
      });

      // Make the actual API call via content script
      const result = await this.makeApiCall(request);

      // Parse rate limit headers if present
      if (result.headers) {
        const rateLimitInfo = this.rateLimitDetector.parseHeaders(
          result.headers,
          request.endpoint
        );

        // Check if we should enter cooldown after this request
        if (rateLimitInfo && this.shouldEnterCooldown(rateLimitInfo)) {
          this.enterCooldown();
        }
      }

      // Calculate execution time
      const executionTime = Date.now() - startTime;
      this.updateAverageExecutionTime(executionTime);

      // Success
      this.metrics.successfulRequests++;
      this.activeRequests.delete(request.id);
      request.resolve(result);

      console.log('[ApiScheduler] Request completed:', {
        id: request.id,
        success: result.success,
        executionTime: `${executionTime}ms`,
      });
    } catch (error) {
      console.error('[ApiScheduler] Request failed:', {
        id: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: request.retryCount + 1,
      });

      // Check if we should retry
      if (request.retryCount < request.maxRetries) {
        await this.retryRequest(request, error);
      } else {
        // Max retries exceeded
        this.metrics.failedRequests++;
        this.lastError = error instanceof Error ? error.message : 'Unknown error';
        this.activeRequests.delete(request.id);
        request.reject(error instanceof Error ? error : new Error('Request failed'));
      }
    } finally {
      this.notifyStateChange();
    }
  }

  /**
   * Make the actual API call via content script
   */
  private async makeApiCall(request: QueuedRequest): Promise<RequestResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.config.requestTimeout);

      chrome.tabs
        .sendMessage(request.tabId, {
          action: 'makeApiRequest',
          endpoint: request.endpoint,
          method: request.method,
          body: request.body,
        })
        .then((response) => {
          clearTimeout(timeout);
          resolve(response);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Retry a failed request
   */
  private async retryRequest(request: QueuedRequest, _error: any): Promise<void> {
    request.retryCount++;
    this.metrics.retriedRequests++;

    // Calculate exponential backoff delay
    const backoffDelay = this.config.retryDelay * Math.pow(2, request.retryCount - 1);

    console.log('[ApiScheduler] Retrying request:', {
      id: request.id,
      attempt: request.retryCount + 1,
      maxRetries: request.maxRetries,
      delayMs: backoffDelay,
    });

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, backoffDelay));

    // Re-add to queue with high priority
    this.activeRequests.delete(request.id);
    request.priority = 'high';
    this.addToQueue(request);
  }

  /**
   * Check if we should enter cooldown based on rate limit info
   */
  private shouldEnterCooldown(info: RateLimitInfo): boolean {
    const percentRemaining = (info.remaining / info.limit) * 100;
    return percentRemaining <= this.config.minRemainingThreshold;
  }

  /**
   * Enter cooldown mode
   */
  private enterCooldown(): void {
    const info = this.rateLimitDetector.getMostRestrictive();
    if (!info) return;

    // Use the longer of: configured cooldown or time until reset
    const resetWaitTime = this.rateLimitDetector.getMillisecondsUntilReset(info);
    const cooldownDuration = Math.max(this.config.cooldownDuration, resetWaitTime);

    this.cooldownEndsAt = Date.now() + cooldownDuration;
    this.metrics.cooldownEvents++;

    console.warn('[ApiScheduler] Entering cooldown mode:', {
      remaining: info.remaining,
      limit: info.limit,
      cooldownDuration: `${Math.ceil(cooldownDuration / 1000)}s`,
      endsAt: new Date(this.cooldownEndsAt).toISOString(),
    });

    this.updateStatus('cooldown');
    this.notifyStateChange();
  }

  /**
   * Pause the scheduler
   */
  pause(): void {
    this.isPaused = true;
    this.updateStatus('paused');
    console.log('[ApiScheduler] Paused');
  }

  /**
   * Resume the scheduler
   */
  resume(): void {
    this.isPaused = false;
    console.log('[ApiScheduler] Resumed');
  }

  /**
   * Update scheduler status
   */
  private updateStatus(status: SchedulerStatus): void {
    if (this.status !== status) {
      this.status = status;
      console.log('[ApiScheduler] Status changed:', status);
    }
  }

  /**
   * Get current scheduler state
   */
  getState(): SchedulerState {
    return {
      status: this.status,
      queueLength: this.queue.length,
      activeRequests: this.activeRequests.size,
      totalProcessed: this.metrics.successfulRequests + this.metrics.failedRequests,
      rateLimitInfo: this.rateLimitDetector.getMostRestrictive(),
      cooldownEndsAt: this.cooldownEndsAt,
      errorCount: this.metrics.failedRequests,
      lastError: this.lastError,
    };
  }

  /**
   * Get scheduler metrics
   */
  getMetrics(): SchedulerMetrics {
    return { ...this.metrics };
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(listener: (state: SchedulerState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyStateChange(): void {
    const state = this.getState();
    this.stateListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('[ApiScheduler] Error in state listener:', error);
      }
    });
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update average execution time metric
   */
  private updateAverageExecutionTime(executionTime: number): void {
    const total = this.metrics.successfulRequests + this.metrics.failedRequests;
    const currentAvg = this.metrics.averageExecutionTime;
    this.metrics.averageExecutionTime = (currentAvg * (total - 1) + executionTime) / total;
  }

  /**
   * Clear the queue (useful for testing or emergency stop)
   */
  clearQueue(): void {
    const queueLength = this.queue.length;
    this.queue = [];
    console.log(`[ApiScheduler] Cleared ${queueLength} requests from queue`);
    this.notifyStateChange();
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retriedRequests: 0,
      cacheHits: 0,
      averageWaitTime: 0,
      averageExecutionTime: 0,
      cooldownEvents: 0,
      throttleEvents: 0,
    };
    console.log('[ApiScheduler] Metrics reset');
  }
}
