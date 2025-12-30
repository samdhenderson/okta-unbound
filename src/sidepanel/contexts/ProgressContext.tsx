/**
 * @module contexts/ProgressContext
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

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

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
  startProgress: (operationName: string, message: string, total?: number, canCancel?: boolean) => void;
  updateProgress: (current: number, total?: number, message?: string, apiCalls?: number) => void;
  incrementApiCalls: () => void;
  completeProgress: () => void;
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

  const startProgress = useCallback((operationName: string, message: string, total: number = 100, canCancel: boolean = true) => {
    setProgress({
      isLoading: true,
      current: 0,
      total,
      message,
      operationName,
      apiCalls: 0,
      startTime: Date.now(),
      canCancel,
    });
  }, []);

  const updateProgress = useCallback((current: number, total?: number, message?: string, apiCalls?: number) => {
    setProgress((prev) => ({
      ...prev,
      isLoading: true,
      current,
      total: total ?? prev.total,
      message: message ?? prev.message,
      apiCalls: apiCalls ?? prev.apiCalls,
    }));
  }, []);

  const incrementApiCalls = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      apiCalls: (prev.apiCalls || 0) + 1,
    }));
  }, []);

  const completeProgress = useCallback(() => {
    setProgress({
      isLoading: false,
      current: 0,
      total: 100,
      message: '',
    });
  }, []);

  const contextValue = useMemo(() => ({
    progress,
    startProgress,
    updateProgress,
    incrementApiCalls,
    completeProgress,
  }), [progress, startProgress, updateProgress, incrementApiCalls, completeProgress]);

  return (
    <ProgressContext.Provider value={contextValue}>
      {children}
    </ProgressContext.Provider>
  );
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
