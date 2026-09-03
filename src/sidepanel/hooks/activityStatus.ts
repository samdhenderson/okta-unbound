/**
 * @module sidepanel/hooks/activityStatus
 * @description The activity bar's status vocabulary: one label and one colour
 * token per {@link SchedulerStatus}.
 *
 * Lookup maps rather than a `switch`, per the `Record<Variant, string>`
 * convention in `docs/components.md` — a new scheduler status then fails to
 * compile until both maps answer for it, instead of silently falling through to
 * a default that reads as "Ready".
 */
import type { SchedulerStatus } from '../../shared/scheduler/types';

/**
 * The status dot's colour, as a design-token custom-property expression.
 *
 * A CSS variable rather than a class because the dot is one element whose colour
 * is fully data-driven; there is no variant to name.
 */
export const STATUS_COLOR: Record<SchedulerStatus, string> = {
  idle: 'var(--color-success)',
  processing: 'var(--color-info)',
  throttled: 'var(--color-warning)',
  cooldown: 'var(--color-danger)',
  paused: 'var(--color-neutral-500)',
};

/** The word the bar shows for each scheduler status. */
export const STATUS_LABEL: Record<SchedulerStatus, string> = {
  idle: 'Ready',
  processing: 'Processing',
  throttled: 'Throttled',
  cooldown: 'Cooldown',
  paused: 'Paused',
};
