import React from 'react';
import Icon, { type IconType } from '../overview/shared/Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconType;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  fullWidth?: boolean;
  badge?: string;
  title?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: `
    bg-primary hover:bg-primary-dark
    text-white font-semibold
    disabled:bg-primary-highlight disabled:text-neutral-400
  `,
  secondary: `
    bg-white hover:bg-neutral-50
    text-neutral-900 font-medium
    border border-neutral-200 hover:border-neutral-500
    disabled:bg-neutral-50 disabled:text-neutral-400 disabled:border-neutral-200
  `,
  danger: `
    bg-danger hover:bg-danger-text
    text-white font-semibold
    disabled:bg-danger-light disabled:text-neutral-400
  `,
  success: `
    bg-success hover:bg-success-text
    text-white font-semibold
    disabled:bg-success-light disabled:text-neutral-400
  `,
  ghost: `
    bg-transparent hover:bg-neutral-50
    text-neutral-700 font-medium
    disabled:text-neutral-400
  `,
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-4 py-3 text-base',
};

const sizeHeights: Record<ButtonSize, string> = {
  sm: '36px',
  md: '40px',
  lg: '56px',
};

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = '',
  fullWidth = false,
  badge,
  title,
}) => {
  const baseClasses = `
    inline-flex items-center justify-center gap-2
    rounded-md transition-all duration-100
    disabled:cursor-not-allowed
    focus:outline-2 focus:outline-offset-2 focus:outline-primary
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${fullWidth ? 'w-full' : ''}
  `.trim().replace(/\s+/g, ' ');

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${className}`}
      title={title}
      style={{ fontFamily: 'var(--font-heading)', minHeight: sizeHeights[size] }}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {!loading && icon && iconPosition === 'left' && (
        <Icon type={icon} size={size === 'sm' ? 'sm' : 'md'} />
      )}
      <span>{children}</span>
      {!loading && icon && iconPosition === 'right' && (
        <Icon type={icon} size={size === 'sm' ? 'sm' : 'md'} />
      )}
      {badge && (
        <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-danger text-white">
          {badge}
        </span>
      )}
    </button>
  );
};

export default Button;
