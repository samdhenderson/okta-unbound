import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface ProgressState {
  isLoading: boolean;
  current: number;
  total: number;
  message: string;
}

interface ProgressContextType {
  progress: ProgressState;
  startProgress: (message: string, total?: number) => void;
  updateProgress: (current: number, total?: number, message?: string) => void;
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

  const startProgress = (message: string, total: number = 100) => {
    setProgress({
      isLoading: true,
      current: 0,
      total,
      message,
    });
  };

  const updateProgress = (current: number, total?: number, message?: string) => {
    setProgress((prev) => ({
      isLoading: true,
      current,
      total: total ?? prev.total,
      message: message ?? prev.message,
    }));
  };

  const completeProgress = () => {
    setProgress({
      isLoading: false,
      current: 0,
      total: 100,
      message: '',
    });
  };

  return (
    <ProgressContext.Provider value={{ progress, startProgress, updateProgress, completeProgress }}>
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
