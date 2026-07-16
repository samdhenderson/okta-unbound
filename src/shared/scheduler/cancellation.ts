/**
 * @module shared/scheduler/cancellation
 * @description Shared cancellation primitive for long-running operations.
 *
 * Two pieces cooperate to make "Cancel" actually stop work:
 * - {@link OperationCancelledError} is the single typed error raised when the user
 *   cancels — both the background {@link ApiScheduler} (rejecting dropped requests)
 *   and the side-panel operation loops throw/detect it, so cancellation is one
 *   recognizable signal end to end.
 * - {@link createCancellation} is a tiny mutable token that operation drivers poll
 *   between iterations. It is ref-friendly by design: a component holds one token
 *   for the lifetime of an operation and flips it, avoiding the stale-closure trap
 *   where a running loop captured `isCancelled === false` and never re-reads it.
 */

/**
 * Error thrown when an operation (or a queued API request) is cancelled by the
 * user. Detect with `err instanceof OperationCancelledError` rather than matching
 * on the message.
 */
export class OperationCancelledError extends Error {
  /**
   * @param message - Human-readable reason; defaults to `'Operation cancelled'`,
   * the string legacy driver code matched on.
   */
  constructor(message = 'Operation cancelled') {
    super(message);
    this.name = 'OperationCancelledError';
    // Preserve the prototype chain when compiled to ES5-ish targets so
    // `instanceof` keeps working.
    Object.setPrototypeOf(this, OperationCancelledError.prototype);
  }
}

/**
 * A mutable, pollable cancellation token.
 *
 * @property isCancelled - Whether {@link CancellationToken.cancel} has been called
 * since the last {@link CancellationToken.reset}.
 * @property cancel - Trip the token; subsequent `throwIfCancelled()` calls throw.
 * @property reset - Clear the flag so the token can drive the next operation.
 * @property throwIfCancelled - Throw {@link OperationCancelledError} if cancelled;
 * call this between iterations of a long loop.
 */
export interface CancellationToken {
  readonly isCancelled: boolean;
  cancel: () => void;
  reset: () => void;
  throwIfCancelled: () => void;
}

/**
 * Create a fresh {@link CancellationToken}.
 *
 * @returns A token that starts un-cancelled.
 */
export function createCancellation(): CancellationToken {
  let cancelled = false;
  return {
    get isCancelled() {
      return cancelled;
    },
    cancel() {
      cancelled = true;
    },
    reset() {
      cancelled = false;
    },
    throwIfCancelled() {
      if (cancelled) {
        throw new OperationCancelledError();
      }
    },
  };
}
