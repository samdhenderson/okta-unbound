/**
 * @module sidepanel/contexts/ProgressContext
 * @description React context for managing progress state across bulk operations in the application.
 * Provides centralized progress tracking with support for operation names, progress percentages,
 * API call counting, and cancellation capabilities.
 *
 * @example
 * ```tsx
 * // Wrap your app with the provider
 * <ProgressProvider>
 *   <App />
 * </ProgressProvider>
 *
 * // Use in any component
 * const { startProgress, updateProgress, completeProgress } = useProgress();
 *
 * const handleBulkOperation = async () => {
 *   startProgress('Removing Users', 'Starting operation...', 100, true);
 *   for (let i = 0; i < items.length; i++) {
 *     await processItem(items[i]);
 *     updateProgress(i + 1, items.length, `Processing ${i + 1}/${items.length}`);
 *   }
 *   completeProgress();
 * };
 * ```
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { createCancellation } from '../../shared/scheduler/cancellation';

/**
 * @interface ProgressState
 * @description Represents the current state of an ongoing operation
 * @property {boolean} isLoading - Whether an operation is currently in progress
 * @property {number} current - Current progress value (e.g., items processed)
 * @property {number} total - Total progress value (e.g., total items)
 * @property {string} message - Human-readable status message
 * @property {string} [operationName] - Name of the current operation (e.g., "Removing Users")
 * @property {number} [apiCalls] - Number of API calls made during the operation
 * @property {number} [startTime] - Timestamp when the operation started (for duration calculation)
 * @property {boolean} [canCancel] - Whether the operation can be cancelled by the user
 */
export interface ProgressState {
  isLoading: boolean;
  current: number;
  total: number;
  message: string;
  operationName?: string;
  apiCalls?: number;
  startTime?: number;
  canCancel?: boolean;
  /** True from the moment the user cancels until the operation unwinds. */
  isCancelling?: boolean;
}

/**
 * @interface ProgressContextType
 * @description Context value providing progress state and control methods
 * @property {ProgressState} progress - Current progress state
 * @property {Function} startProgress - Initiate a new progress-tracked operation
 * @property {Function} updateProgress - Update progress of the current operation
 * @property {Function} incrementApiCalls - Increment the API call counter
 * @property {Function} completeProgress - Mark the current operation as complete and reset state
 */
interface ProgressContextType {
  progress: ProgressState;
  startProgress: (
    operationName: string,
    message: string,
    total?: number,
    canCancel?: boolean,
  ) => void;
  updateProgress: (current: number, total?: number, message?: string, apiCalls?: number) => void;
  incrementApiCalls: () => void;
  completeProgress: () => void;
  /**
   * Cancel the current operation: trip the shared cancellation token (so operation
   * loops stop between iterations via {@link ProgressContextType.throwIfCancelled})
   * and flag `isCancelling` for the UI. Callers that also own the request queue
   * (the Activity Bar) drain it separately.
   */
  cancel: () => void;
  /**
   * Throw {@link OperationCancelledError} if the current operation was cancelled.
   * Stable identity across renders — safe to thread into memoized transports.
   */
  throwIfCancelled: () => void;
  /**
   * Clear a prior cancel so the next operation runs. `startProgress`/
   * `completeProgress` already reset; call this directly from operation entry
   * points that don't drive the global progress bar (e.g. bulk ops).
   */
  resetCancellation: () => void;
  /** Whether the current operation has been cancelled. */
  isCancelled: boolean;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

/**
 * Progress Provider Component
 *
 * @function ProgressProvider
 * @description Provides progress tracking state and methods to child components.
 * Should wrap the application or feature area where progress tracking is needed.
 *
 * @param {Object} props
 * @param {ReactNode} props.children - Child components to receive progress context
 * @returns {JSX.Element} Provider component
 */
export const ProgressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState<ProgressState>({
    isLoading: false,
    current: 0,
    total: 100,
    message: '',
  });

  // One cancellation token per provider. Held in a ref so the control callbacks
  // below keep stable identities (useOktaApi threads throwIfCancelled into a
  // memoized transport), while start/complete reset it for each new operation.
  const cancellationRef = useRef(createCancellation());
  const [isCancelled, setIsCancelled] = useState(false);

  const startProgress = useCallback(
    (operationName: string, message: string, total: number = 100, canCancel: boolean = true) => {
      cancellationRef.current.reset();
      setIsCancelled(false);
      setProgress({
        isLoading: true,
        current: 0,
        total,
        message,
        operationName,
        apiCalls: 0,
        startTime: Date.now(),
        canCancel,
        isCancelling: false,
      });
    },
    [],
  );

  const updateProgress = useCallback(
    (current: number, total?: number, message?: string, apiCalls?: number) => {
      setProgress((prev) => ({
        ...prev,
        isLoading: true,
        current,
        total: total ?? prev.total,
        message: message ?? prev.message,
        apiCalls: apiCalls ?? prev.apiCalls,
      }));
    },
    [],
  );

  const incrementApiCalls = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      apiCalls: (prev.apiCalls || 0) + 1,
    }));
  }, []);

  const completeProgress = useCallback(() => {
    cancellationRef.current.reset();
    setIsCancelled(false);
    setProgress({
      isLoading: false,
      current: 0,
      total: 100,
      message: '',
    });
  }, []);

  // Stable across renders — cancellationRef never changes identity.
  const cancel = useCallback(() => {
    cancellationRef.current.cancel();
    setIsCancelled(true);
    setProgress((prev) => ({ ...prev, isCancelling: true }));
  }, []);

  const throwIfCancelled = useCallback(() => {
    cancellationRef.current.throwIfCancelled();
  }, []);

  const resetCancellation = useCallback(() => {
    cancellationRef.current.reset();
    setIsCancelled(false);
    setProgress((prev) => (prev.isCancelling ? { ...prev, isCancelling: false } : prev));
  }, []);

  const contextValue = useMemo(
    () => ({
      progress,
      startProgress,
      updateProgress,
      incrementApiCalls,
      completeProgress,
      cancel,
      throwIfCancelled,
      resetCancellation,
      isCancelled,
    }),
    [
      progress,
      startProgress,
      updateProgress,
      incrementApiCalls,
      completeProgress,
      cancel,
      throwIfCancelled,
      resetCancellation,
      isCancelled,
    ],
  );

  return <ProgressContext.Provider value={contextValue}>{children}</ProgressContext.Provider>;
};

/**
 * Hook to access progress context
 *
 * @function useProgress
 * @description Custom hook to access progress state and control methods.
 * Must be used within a ProgressProvider.
 *
 * @returns {ProgressContextType} Progress context value with state and methods
 * @throws {Error} If used outside of ProgressProvider
 *
 * @example
 * ```tsx
 * const { progress, startProgress, updateProgress } = useProgress();
 *
 * // Check if loading
 * if (progress.isLoading) {
 *   console.log(`${progress.operationName}: ${progress.current}/${progress.total}`);
 * }
 * ```
 */
export const useProgress = (): ProgressContextType => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};

/**
 * Access the progress context if one is mounted, else `undefined`.
 *
 * Unlike {@link useProgress} this never throws, so utilities that only *optionally*
 * participate in global progress/cancellation (e.g. `useOktaApi`, which falls back
 * to a local cancellation token) can call it safely outside a
 * {@link ProgressProvider}.
 *
 * @returns The `ProgressContextType`, or `undefined` when no provider is present.
 */
export const useProgressOptional = (): ProgressContextType | undefined =>
  useContext(ProgressContext);
