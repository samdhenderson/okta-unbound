import React from 'react';

export interface AlertMessageData {
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface AlertAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'danger';
}

interface AlertMessageProps {
  message: AlertMessageData;
  onDismiss?: () => void;
  action?: AlertAction;
  className?: string;
}

const typeStyles = {
  info: {
    bg: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-500',
    text: 'text-blue-800',
  },
  success: {
    bg: 'bg-emerald-50 border-emerald-200',
    icon: 'text-emerald-500',
    text: 'text-emerald-800',
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    icon: 'text-amber-500',
    text: 'text-amber-800',
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    icon: 'text-red-500',
    text: 'text-red-800',
  },
};

/**
 * Displays an alert/notification message with dismiss button.
 *
 * @example
 * ```tsx
 * {resultMessage && (
 *   <AlertMessage
 *     message={resultMessage}
 *     onDismiss={() => setResultMessage(null)}
 *   />
 * )}
 * ```
 */
const AlertMessage: React.FC<AlertMessageProps> = ({ message, onDismiss, action, className = '' }) => {
  const styles = typeStyles[message.type];

  return (
    <div
      className={`p-4 rounded-lg border flex items-start justify-between gap-4 ${styles.bg} ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3 flex-1">
        {/* Icon */}
        <svg
          className={`w-5 h-5 shrink-0 mt-0.5 ${styles.icon}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {message.type === 'success' ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          ) : message.type === 'error' ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          ) : message.type === 'warning' ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          )}
        </svg>

        {/* Message text */}
        <span className={`text-sm ${styles.text}`}>{message.text}</span>

        {/* Action button */}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={`ml-3 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              action.variant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : message.type === 'error'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {action.label}
          </button>
        )}
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          type="button"
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-white/50"
          onClick={onDismiss}
          aria-label="Dismiss message"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default AlertMessage;
