# Okta API Scheduler

## Overview

The Okta API Scheduler is a centralized rate-limit-aware scheduling system that coordinates ALL Okta API requests across the entire Okta Unbound extension. It prevents rate limiting issues, provides intelligent backoff, and ensures reliable API operations.

## Architecture

### High-Level Flow

```
UI Component → useOktaApi Hook → Background Service Worker (Scheduler) → Content Script → Okta API
                                                                                        ↓
UI Component ← useOktaApi Hook ← Background Service Worker (Scheduler) ← Content Script ← Okta API
```

### Components

#### 1. **ApiScheduler** (`src/shared/scheduler/apiScheduler.ts`)
The core scheduler that:
- Maintains a priority queue of API requests
- Tracks active requests and enforces concurrency limits
- Implements intelligent retry logic with exponential backoff
- Enters cooldown mode when approaching rate limits
- Broadcasts state changes to the UI

**Key Configuration:**
```typescript
{
  maxConcurrent: 3,           // Max parallel requests
  minRemainingThreshold: 10,  // Cooldown at 10% remaining
  cooldownDuration: 60000,    // 60 second cooldown
  retryDelay: 2000,          // 2 second base retry delay
  maxRetries: 3,             // Max retry attempts
  requestTimeout: 30000      // 30 second timeout
}
```

#### 2. **RateLimitDetector** (`src/shared/scheduler/rateLimitDetector.ts`)
Parses and tracks Okta rate limit headers:
- `X-Rate-Limit-Limit`: Total requests allowed per window
- `X-Rate-Limit-Remaining`: Requests remaining in current window
- `X-Rate-Limit-Reset`: Unix timestamp when window resets

The detector:
- Tracks limits per endpoint and globally
- Calculates recommended wait times
- Triggers cooldown when approaching limits
- Cleans up expired limit information

#### 3. **Background Service Worker** (`src/background/index.ts`)
Hosts the global scheduler instance and:
- Initializes scheduler on extension load
- Handles message routing for API requests
- Broadcasts scheduler state changes
- Manages tab state cleanup

#### 4. **SchedulerContext** (`src/sidepanel/contexts/SchedulerContext.tsx`)
React context providing:
- Real-time scheduler state
- Scheduler metrics
- Control functions (pause, resume, clear queue)
- Auto-refreshing state updates

#### 5. **SchedulerStatusBar** (`src/sidepanel/components/SchedulerStatusBar.tsx`)
UI component showing:
- Current scheduler status (idle, processing, cooldown, etc.)
- Queue length and active requests
- Rate limit information
- Cooldown countdown

## Request Flow

### 1. Scheduling a Request

```typescript
// In useOktaApi hook
const makeApiRequest = async (endpoint, method, body, priority = 'normal') => {
  const response = await chrome.runtime.sendMessage({
    action: 'scheduleApiRequest',
    endpoint,
    method,
    body,
    tabId: targetTabId,
    priority,
  });
  return response;
};
```

### 2. Background Processing

```typescript
// In background service worker
case 'scheduleApiRequest':
  globalScheduler
    .scheduleRequest(endpoint, method, body, tabId, priority)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ success: false, error: error.message }));
  return true;
```

### 3. Execution

The scheduler:
1. Adds request to priority queue
2. Waits for available concurrency slot
3. Checks rate limits
4. Executes request via content script
5. Parses rate limit headers
6. Updates state and notifies listeners
7. Handles retries on failure

## Priority Levels

Requests can be scheduled with three priority levels:

- **High**: User-initiated single operations, retry attempts
- **Normal**: Standard batch operations (default)
- **Low**: Background refreshes, non-urgent tasks

Higher priority requests are executed before lower priority ones.

## Rate Limit Handling

### Detection

The scheduler monitors the `X-Rate-Limit-Remaining` header and enters cooldown when:
- Remaining requests < 10% of limit
- Calculated as `(remaining / limit * 100) <= 10`

### Cooldown Mode

When cooldown is triggered:
1. Queue processing pauses
2. Status changes to 'cooldown'
3. UI shows countdown timer
4. Scheduler waits for the longer of:
   - Configured cooldown duration (60s)
   - Time until rate limit resets
5. Automatically resumes when safe

### Safe Operation

The scheduler maintains a safety margin by:
- Triggering cooldown early (at 10% remaining)
- Spreading requests across the time window
- Limiting concurrent requests to 3
- Implementing exponential backoff on errors

## State Management

### Scheduler State

```typescript
interface SchedulerState {
  status: 'idle' | 'processing' | 'throttled' | 'cooldown' | 'paused';
  queueLength: number;
  activeRequests: number;
  totalProcessed: number;
  rateLimitInfo: RateLimitInfo | null;
  cooldownEndsAt: number | null;
  errorCount: number;
  lastError: string | null;
}
```

### Metrics

```typescript
interface SchedulerMetrics {
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
```

## Integration Guide

### Using the Scheduler in Components

The scheduler is automatically integrated via `useOktaApi`. All existing API calls now route through it:

```typescript
const api = useOktaApi({ targetTabId, onResult, onProgress });

// This automatically uses the scheduler
const result = await api.makeApiRequest('/api/v1/groups/123', 'GET');
```

### Monitoring Scheduler Status

```typescript
import { useScheduler } from '../contexts/SchedulerContext';

const MyComponent = () => {
  const { state, metrics, pause, resume } = useScheduler();

  return (
    <div>
      <p>Status: {state?.status}</p>
      <p>Queue: {state?.queueLength}</p>
      {state?.status === 'cooldown' && (
        <p>Cooling down until: {new Date(state.cooldownEndsAt).toLocaleString()}</p>
      )}
    </div>
  );
};
```

## Error Handling

### Automatic Retries

Failed requests are automatically retried up to 3 times with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: Wait 2s
- Attempt 3: Wait 4s
- Attempt 4: Wait 8s

### Request Timeout

Each request has a 30-second timeout. If exceeded, the request is rejected and can be retried.

### Error Propagation

Errors are propagated back to the calling code after all retries are exhausted, preserving the original error message.

## Performance Considerations

### Concurrency

The scheduler limits concurrent requests to 3, which:
- Reduces load on Okta servers
- Prevents overwhelming browser memory
- Makes rate limit tracking more accurate
- Provides smoother UX with predictable performance

### Memory Management

The scheduler:
- Limits queue size naturally through UI constraints
- Clears completed requests immediately
- Periodically cleans up expired rate limit data
- Broadcasts state efficiently (only on changes)

### Network Efficiency

- Requests are batched naturally through the queue
- Rate limit headers reduce redundant polling
- Cooldown prevents wasted requests
- Failed requests use exponential backoff

## Debugging

### Console Logging

The scheduler logs extensively:

```
[ApiScheduler] Initialized with config: {...}
[ApiScheduler] Scheduled request: { id, endpoint, method, priority, queueLength }
[ApiScheduler] Executing request: { id, endpoint, method, attempt }
[ApiScheduler] Request completed: { id, success, executionTime }
[ApiScheduler] Entering cooldown mode: { remaining, limit, cooldownDuration }
[ApiScheduler] Cooldown ended, resuming processing
```

### Accessing Metrics

```typescript
// In background console
const metrics = globalScheduler.getMetrics();
console.table(metrics);
```

### State Inspection

```typescript
// In background console
const state = globalScheduler.getState();
console.log('Queue:', state.queueLength);
console.log('Active:', state.activeRequests);
console.log('Rate limit:', state.rateLimitInfo);
```

## Testing

### Manual Testing

1. Open extension on Okta page
2. Perform bulk operations (remove users, load groups, etc.)
3. Watch SchedulerStatusBar at bottom of screen
4. Observe queue processing and rate limit tracking
5. Trigger cooldown by rapid API calls
6. Verify automatic resumption after cooldown

### Simulating Rate Limits

To test cooldown behavior, modify the configuration:

```typescript
const globalScheduler = new ApiScheduler({
  minRemainingThreshold: 90, // Trigger cooldown at 90% remaining
  cooldownDuration: 10000,   // 10 second cooldown for faster testing
});
```

## Future Enhancements

Potential improvements:
- Request deduplication (skip identical pending requests)
- Cache integration (return cached results instantly)
- Request prioritization by user action vs background
- Batch request optimization
- Per-endpoint rate limit tracking
- Adaptive concurrency based on performance
- Request cancellation support
- Offline queue persistence

## Okta Rate Limits

Reference: https://developer.okta.com/docs/reference/rate-limits/

Common limits:
- **Org-wide**: 10,000 requests per minute
- **Per-endpoint**: Varies (e.g., /api/v1/users: 600/min)
- **Concurrent requests**: 100 max

The scheduler is designed to stay well below these limits for reliable operation.
