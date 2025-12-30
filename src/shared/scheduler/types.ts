/**
 * Okta API Scheduler Types
 *
 * Type definitions for the centralized API scheduling system that prevents
 * rate limiting and coordinates all Okta API requests across the extension.
 */

export type RequestPriority = 'high' | 'normal' | 'low';
export type SchedulerStatus = 'idle' | 'processing' | 'throttled' | 'cooldown' | 'paused';

/**
 * Queued API request
 */
export interface QueuedRequest {
  id: string;
  endpoint: string;
  method: string;
  body?: any;
  priority: RequestPriority;
  tabId: number;
  timestamp: number;
  resolve: (response: any) => void;
  reject: (error: Error) => void;
  retryCount: number;
  maxRetries: number;
}

/**
 * Rate limit information from Okta response headers
 */
export interface RateLimitInfo {
  limit: number; // X-Rate-Limit-Limit
  remaining: number; // X-Rate-Limit-Remaining
  reset: number; // X-Rate-Limit-Reset (Unix timestamp in seconds)
  endpoint: string;
  timestamp: number;
}

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  maxConcurrent: number; // Max parallel requests
  minRemainingThreshold: number; // Trigger cooldown when remaining < this (percentage)
  cooldownDuration: number; // How long to pause when threshold hit (ms)
  retryDelay: number; // Base retry delay for failed requests (ms)
  maxRetries: number; // Max retry attempts per request
  requestTimeout: number; // Timeout for individual requests (ms)
}

/**
 * Scheduler state for UI display
 */
export interface SchedulerState {
  status: SchedulerStatus;
  queueLength: number;
  activeRequests: number;
  totalProcessed: number;
  rateLimitInfo: RateLimitInfo | null;
  cooldownEndsAt: number | null; // Timestamp when cooldown ends
  errorCount: number;
  lastError: string | null;
}

/**
 * Request execution result
 */
export interface RequestResult {
  success: boolean;
  data?: any;
  error?: string;
  headers?: Record<string, string>;
  status?: number;
  fromCache?: boolean;
}

/**
 * Scheduler metrics for debugging
 */
export interface SchedulerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  retriedRequests: number;
  cacheHits: number;
  averageWaitTime: number;
  averageExecutionTime: number;
  cooldownEvents: number;
  throttleEvents: number;
}
