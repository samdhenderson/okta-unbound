import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

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

interface ProgressContextType {
  progress: ProgressState;
  startProgress: (operationName: string, message: string, total?: number, canCancel?: boolean) => void;
  updateProgress: (current: number, total?: number, message?: string, apiCalls?: number) => void;
  incrementApiCalls: () => void;
  completeProgress: () => void;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

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

export const useProgress = (): ProgressContextType => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};
