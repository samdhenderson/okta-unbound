/**
 * @module sidepanel/components/activity/barParts
 * @description The three pieces the activity bar's condensed and full trees both
 * need: the status dot, the progress track, and the collapse chevron.
 *
 * They live here rather than in `ActivityBarView` because ADR-0008 keeps the two
 * layouts as **separate trees that are swapped, not cross-faded** — so anything
 * common to both is duplicated at the call site unless it is a component. That
 * swap is deliberate and is not to be "fixed": a crossfade needs both trees
 * mounted at once, which would duplicate the Cancel control and the bar's
 * `role="status"` live region, and their differing heights would move the bar's
 * top edge.
 */
import React from 'react';

/**
 * The bar's live-state dot.
 *
 * `.motion-exempt`: the pulse encodes "the scheduler is busy", not a decorative
 * entrance, so it keeps animating under `prefers-reduced-motion`.
 */
export const StatusDot: React.FC<{
  /** Whether to pulse — anything other than fully idle. */
  busy: boolean;
  /** A design-token CSS custom-property expression for the dot's colour. */
  colorVar: string;
}> = ({ busy, colorVar }) => (
  <div
    aria-hidden="true"
    className={`motion-exempt h-2 w-2 shrink-0 rounded-full shadow-sm ${busy ? 'animate-pulse' : ''}`}
    style={{ backgroundColor: colorVar }}
  />
);

/**
 * The hairline progress track along the bar's bottom edge.
 *
 * Stays mounted at 0% when idle, so gaining progress never changes the bar's
 * height. `.motion-exempt` for the same reason as the dot; `--dur-tell` because
 * each scheduler tick advances the fill by a fraction of a percent, and over
 * half a second a stream of them blends into one sweep instead of a twitching
 * stub. Width only — the height is fixed, so nothing around it can move.
 */
export const ProgressTrack: React.FC<{
  /** Completion, 0–100. */
  percentage: number;
}> = ({ percentage }) => (
  <div
    role="progressbar"
    aria-label="Operation progress"
    aria-valuenow={Math.round(percentage)}
    aria-valuemin={0}
    aria-valuemax={100}
    className="h-1 w-full bg-neutral-100"
  >
    <div
      className="motion-exempt h-full bg-primary transition-[width] duration-(--dur-tell) ease-standard"
      style={{ width: `${percentage}%` }}
    />
  </div>
);

/** Chevron glyph that points right when collapsed and down when expanded. */
export const CollapseChevron: React.FC<{
  /** Whether the bar is currently condensed. */
  collapsed: boolean;
}> = ({ collapsed }) => (
  <svg
    aria-hidden="true"
    className={`h-4 w-4 transition-transform duration-(--dur-quick) ease-standard ${
      collapsed ? '' : 'rotate-90'
    }`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
