/**
 * @module sidepanel/components/shared/StatCard
 * @description Single metric tile (title, value, optional icon) used in the Overview stat grids.
 *
 * Presentational only: a colored, optionally clickable card. Numeric values are
 * localized with `toLocaleString`; the `color` prop selects an icon/border token set.
 *
 * A card can opt into counting its number up when it resolves (`countUp`), which is
 * what tells the user "this figure just arrived" rather than "this was always here".
 * The value is always rendered with `tabular-nums` so its width cannot twitch as the
 * digits change. The same opt-in also briefly tints the settled figure
 * `text-success-text`, easing back over `--dur-tell` (ADR-0046) — see
 * {@link module:sidepanel/hooks/useCountUp}, which this component extends rather
 * than duplicates.
 *
 * A card with `onClick` is itself a click target and carries the shared `.press`
 * depress plus `.lift` hover elevation (ADR-0046/ADR-0047) — the one card shape in
 * this file list that is genuinely clickable rather than static.
 */
import React from 'react';
import Icon, { type IconType } from './Icon';
import { useCountUp } from '../../hooks/useCountUp';

/** Props for {@link StatCard}. */
interface StatCardProps {
  /** Uppercase label above the value. */
  title: string;
  /** The metric; numbers are rendered with thousands separators. */
  value: number | string;
  /** Semantic color, selecting the icon and border token set; defaults to `neutral`. */
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  /** Optional icon shown at the top-right. */
  icon?: IconType;
  /** Optional caption below the value. */
  subtitle?: string;
  /**
   * When provided, makes the whole card an activatable button — `role="button"`,
   * a real tab stop, and Enter/Space alongside click, not a mouse-only `onClick`
   * on a `<div>`.
   */
  onClick?: () => void;
  /**
   * Count a numeric `value` up to its figure over `--dur-tell` when it first
   * resolves and whenever it changes (an explicit refresh) — never on an incidental
   * re-render. Ignored for string values, and instant under reduced motion.
   * Defaults to `false`.
   */
  countUp?: boolean;
}

const colorConfigs = {
  primary: {
    iconBg: 'bg-primary-light',
    iconColor: 'text-primary-text',
    cardBg: 'bg-white',
    border: 'border-primary-highlight',
    textColor: 'text-neutral-900',
  },
  success: {
    iconBg: 'bg-success-light',
    iconColor: 'text-success-text',
    cardBg: 'bg-white',
    border: 'border-neutral-200',
    textColor: 'text-neutral-900',
  },
  warning: {
    iconBg: 'bg-warning-light',
    iconColor: 'text-warning-text',
    cardBg: 'bg-white',
    border: 'border-neutral-200',
    textColor: 'text-neutral-900',
  },
  danger: {
    iconBg: 'bg-danger-light',
    iconColor: 'text-danger-text',
    cardBg: 'bg-white',
    border: 'border-neutral-200',
    textColor: 'text-neutral-900',
  },
  neutral: {
    iconBg: 'bg-neutral-100',
    iconColor: 'text-neutral-600',
    cardBg: 'bg-white',
    border: 'border-neutral-200',
    textColor: 'text-neutral-900',
  },
};

/** Renders one metric tile; the `color` prop maps to a token set in `colorConfigs`. */
const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  color = 'neutral',
  icon,
  subtitle,
  onClick,
  countUp = false,
}) => {
  const config = colorConfigs[color];

  // Only a resolved number can be counted; a string metric (a status, an em dash
  // placeholder) renders verbatim and the interpolator is switched off entirely.
  const numericValue = typeof value === 'number' ? value : null;
  const { value: countedValue, justResolved } = useCountUp(numericValue ?? 0, {
    enabled: countUp && numericValue !== null,
  });
  const displayValue = numericValue === null ? value : countedValue.toLocaleString();

  // A clickable card is the one shape in this file that is genuinely interactive
  // (ADR-0046/ADR-0047), so it swaps the plain hover-colour transition for `.press`
  // (which already transitions border-color/background-color/color/box-shadow at
  // the same `--dur-instant`, plus the tuned `:active` timing a bare Tailwind
  // `transition-colors` utility would otherwise silently override — Tailwind's
  // utilities layer always wins over `.press`'s `@layer components` rule) and adds
  // `.lift` for hover elevation.
  const interactive = Boolean(onClick);

  const baseClasses = `
    relative overflow-hidden rounded-md border p-4
    ${config.cardBg} ${config.border}
    ${
      interactive
        ? 'press lift cursor-pointer hover:border-neutral-300 active:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
        : 'transition-colors duration-(--dur-instant) ease-standard'
    }
  `.trim();

  // A focus-visible ring is only reachable with a real tab stop: adding `.press`
  // and the ring together made the missing `tabIndex`/keyboard handling visible
  // rather than fixing it, so both are completed here — a mouse-only "button" was
  // the pre-existing gap, not one this pass should ship a new dead style onto.
  const handleKeyDown = interactive
    ? (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onClick?.();
      }
    : undefined;

  return (
    <div
      className={baseClasses}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={{ fontFamily: 'var(--font-primary)' }}
    >
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
          <p
            className={`mt-2 text-3xl font-bold tracking-tight truncate tabular-nums transition-colors duration-(--dur-tell) ${
              justResolved ? 'text-success-text' : config.textColor
            }`}
            style={{ fontFamily: 'var(--font-primary)' }}
          >
            {displayValue}
          </p>
          {subtitle && (
            <p className="mt-1.5 text-xs font-medium text-neutral-500 truncate">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className={`${config.iconBg} p-2.5 rounded-md flex-shrink-0`}>
            <Icon type={icon} className={config.iconColor} size="lg" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
