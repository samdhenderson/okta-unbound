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
    bg-gradient-to-r from-[#007dc1] to-[#3d9dd9]
    hover:from-[#005a8f] hover:to-[#007dc1]
    text-white font-semibold shadow-md hover:shadow-lg
    disabled:from-blue-300 disabled:to-blue-400
  `,
  secondary: `
    bg-white hover:bg-gray-50
    text-gray-700 font-medium
    border border-gray-200 shadow-sm hover:shadow
    disabled:bg-gray-50 disabled:text-gray-400
  `,
  danger: `
    bg-gradient-to-r from-red-600 to-red-700
    hover:from-red-700 hover:to-red-800
    text-white font-semibold shadow-md hover:shadow-lg
    disabled:from-red-300 disabled:to-red-400
  `,
  success: `
    bg-gradient-to-r from-emerald-600 to-emerald-700
    hover:from-emerald-700 hover:to-emerald-800
    text-white font-semibold shadow-md hover:shadow-lg
    disabled:from-emerald-300 disabled:to-emerald-400
  `,
  ghost: `
    bg-transparent hover:bg-gray-100/80
    text-gray-700 font-medium
    disabled:text-gray-400
  `,
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
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
    rounded-lg transition-all duration-200
    disabled:cursor-not-allowed disabled:opacity-50
    hover:-translate-y-0.5 disabled:hover:translate-y-0
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#007dc1]/30
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
      style={{ fontFamily: 'var(--font-primary)' }}
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
        <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
          {badge}
        </span>
      )}
    </button>
  );
};

export default Button;
