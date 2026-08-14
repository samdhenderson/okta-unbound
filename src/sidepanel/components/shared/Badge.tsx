/**
 * @module sidepanel/components/shared/Badge
 * @description The single home for the badge/pill recipe (ADR-0030).
 *
 * Before this component the recipe `px-2 py-0.5 rounded-md text-xs font-medium`
 * plus a token background/border was hand-rolled in eighteen files, and one of
 * those copies had rotted: `GroupMembershipsList` emitted `badge badge-info` /
 * `badge-success` / `badge-muted`, class names whose CSS was dropped in the
 * Tailwind v4 migration. They matched nothing, so that badge rendered as bare
 * unstyled text. A primitive is how that stops being possible.
 *
 * Variants follow the shared status vocabulary — `danger`, never `error`
 * (ADR-0002) — plus `neutral` for "no signal" and `primary` for identity/type
 * marks that are not a severity at all.
 *
 * A badge is a **label, not a control**. If it needs a click handler, reach for
 * `FilterPill` (two-state toggle) or `Button`; a clickable `<span>` is the bug
 * this component exists to prevent.
 */
import React from 'react';
import type { StatusType } from './status';

/**
 * Badge treatments: the canonical {@link StatusType} severities, plus `neutral`
 * for an uncolored mark and `primary` for entity type/identity.
 *
 * Deliberately a superset of `UserStatusVariant`, so `userStatusVariant()`'s
 * return value drops straight into `variant` with no mapping layer.
 */
export type BadgeVariant = StatusType | 'neutral' | 'primary';

/** Props for {@link Badge}. */
export interface BadgeProps {
  /** Badge label. Keep it to a word or two — this is a mark, not a sentence. */
  children: React.ReactNode;
  /** Colour treatment. Defaults to `neutral`. */
  variant?: BadgeVariant;
  /**
   * Render the filled treatment instead of the tinted one. Reserve it for the
   * one badge on screen that must win — e.g. "Current group" among a list of
   * ordinary type marks. Two solid badges side by side both lose.
   */
  solid?: boolean;
  /** Native `title` tooltip, for a mark whose full meaning does not fit. */
  title?: string;
  /** Extra classes merged after the variant classes. */
  className?: string;
  /** Optional test handle. */
  testId?: string;
}

/**
 * Tinted treatment per variant. `info` and `primary` resolve to the same tokens
 * because `--color-info` *is* `--color-primary` in the theme; both names are
 * kept so call sites can say which they mean.
 */
const softClasses: Record<BadgeVariant, string> = {
  primary: 'bg-primary-light text-primary-text border-primary-highlight',
  info: 'bg-primary-light text-primary-text border-primary-highlight',
  success: 'bg-success-light text-success-text border-success-light',
  warning: 'bg-warning-light text-warning-text border-warning-light',
  danger: 'bg-danger-light text-danger-text border-danger-light',
  neutral: 'bg-neutral-50 text-neutral-700 border-neutral-200',
};

/** Filled treatment per variant, for the one mark that must outrank its siblings. */
const solidClasses: Record<BadgeVariant, string> = {
  primary: 'bg-primary text-white border-primary',
  info: 'bg-primary text-white border-primary',
  success: 'bg-success text-white border-success',
  warning: 'bg-warning text-white border-warning',
  danger: 'bg-danger text-white border-danger',
  neutral: 'bg-neutral-700 text-white border-neutral-700',
};

/**
 * A small status or type mark.
 *
 * @example
 * ```tsx
 * <Badge variant="success">Active</Badge>
 * <Badge variant="primary" solid>Current group</Badge>
 * <Badge variant={userStatusVariant(user.status)}>{user.status}</Badge>
 * ```
 */
const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  solid = false,
  title,
  className = '',
  testId,
}) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap ${
      solid ? solidClasses[variant] : softClasses[variant]
    } ${className}`}
    title={title}
    data-testid={testId}
  >
    {children}
  </span>
);

export default Badge;
