/**
 * @module sidepanel/components/shared/AlertMessage
 * @description Inline alert/notification banner with a status icon and optional dismiss + action button.
 *
 * Colour and icon are driven by the canonical {@link StatusType} vocabulary
 * (`success | warning | danger | info` — ADR-0002). Renders with `role="alert"`.
 */
import React from 'react';
import { type StatusType } from './status';

/** The content of an alert: display text plus its severity. */
export interface AlertMessageData {
  text: string;
  /** Canonical status vocabulary — `success | warning | danger | info` (ADR-0002). Selects icon + colours. */
  type: StatusType;
}

/** An optional inline call-to-action button rendered next to the message text. */
export interface AlertAction {
  label: string;
  onClick: () => void;
  /** Visual emphasis of the action button. Forced to `danger` styling when the message itself is `danger`. */
  variant?: 'primary' | 'danger';
}

interface AlertMessageProps {
  /** The alert text + severity to display. */
  message: AlertMessageData;
  /** When provided, renders a dismiss (×) button that invokes this callback. */
  onDismiss?: () => void;
  /** Optional inline action button (e.g. "Retry", "Undo"). */
  action?: AlertAction;
  /** Extra classes merged onto the outer container. */
  className?: string;
}

const typeStyles = {
  info: {
    bg: 'bg-info-light border-primary-highlight',
    icon: 'text-primary-text',
    text: 'text-primary-dark',
  },
  success: {
    bg: 'bg-success-light border-success-light',
    icon: 'text-success',
    text: 'text-success-text',
  },
  warning: {
    bg: 'bg-warning-light border-warning-light',
    icon: 'text-warning',
    text: 'text-warning-text',
  },
  danger: {
    bg: 'bg-danger-light border-danger-light',
    icon: 'text-danger',
    text: 'text-danger-text',
  },
};

/**
 * Displays an alert/notification message with a status icon and optional
 * dismiss button and action. The icon and colour scheme follow `message.type`.
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
const AlertMessage: React.FC<AlertMessageProps> = ({
  message,
  onDismiss,
  action,
  className = '',
}) => {
  const status = message.type;
  const styles = typeStyles[status];

  return (
    <div
      className={`p-4 rounded-md border flex items-start justify-between gap-4 ${styles.bg} ${className}`}
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
          {status === 'success' ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          ) : status === 'danger' ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          ) : status === 'warning' ? (
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
            className={`ml-3 px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-100 ${
              action.variant === 'danger' || status === 'danger'
                ? 'bg-danger text-white hover:bg-danger-text'
                : 'bg-primary text-white hover:bg-primary-dark'
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
          className="text-neutral-400 hover:text-neutral-600 transition-colors duration-100 p-1 rounded-full hover:bg-white/50"
          onClick={onDismiss}
          aria-label="Dismiss message"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default AlertMessage;
