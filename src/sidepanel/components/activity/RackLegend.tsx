/**
 * @module sidepanel/components/activity/RackLegend
 * @description The key to the bucket rack's lanes: what each fill, dash and
 * hatch on a track means.
 *
 * ## Why a legend, when every lane already says it in words
 *
 * Because those two channels do different jobs. A lane's label line names the
 * state of *that* lane — "4 running · 61 queued" — and it is what makes the rack
 * readable with the patterns ignored entirely. The legend names the *vocabulary*,
 * once, so a reader can learn the track's grammar and then read six lanes by
 * shape at a glance instead of six label lines in sequence. Comparing families is
 * the whole reason the rack exists (ADR-0059); a legend is what makes the
 * comparison happen in one look rather than six.
 *
 * It also carries the one thing no single lane can say: that a pale tail is
 * *headroom*, not absence. A track drawn against remaining budget has a
 * meaningful empty part, and nothing in a lane's own words explains that.
 *
 * ## What the swatches are and are not
 *
 * Each swatch is `aria-hidden`; the text beside it carries the meaning. So the
 * legend costs a screen-reader user nothing and tells them nothing they are
 * missing — every magnitude it keys is already in each lane's accessible name.
 * It is decoration in the accessibility tree and information in the visual one,
 * which is the correct split for a key.
 *
 * @see `./hatches` — the patterns this names.
 * @see `ADR-0072` — the lane grammar being keyed.
 */
import React from 'react';
import { COOLDOWN_HATCH, QUEUED_DASHES, UNKNOWN_HATCH } from './hatches';

/** One swatch-and-label pair. */
const Key: React.FC<{
  /** What the swatch says. Two words at most — this is a key, not a sentence. */
  label: string;
  /** Tailwind classes for the swatch's ground. */
  className?: string;
  /** Inline style for the swatch, used for the token-built gradients. */
  style?: React.CSSProperties;
}> = ({ label, className = '', style }) => (
  <span className="flex shrink-0 items-center gap-1">
    <span
      aria-hidden="true"
      className={`h-2 w-4 shrink-0 rounded-full ${className}`}
      style={style}
    />
    <span>{label}</span>
  </span>
);

/**
 * Render the rack's key.
 *
 * Wraps rather than scrolls: on a narrow panel it becomes two short rows, which
 * costs a few pixels once, where a horizontal scroller would hide half the
 * vocabulary behind a gesture nobody knows to make.
 */
const RackLegend: React.FC = () => (
  <div
    data-testid="activity-rack-legend"
    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-(--sp-gutter) pt-1.5 text-xs text-neutral-500"
  >
    <Key label="running" className="bg-primary" />
    <Key label="queued" style={{ backgroundImage: QUEUED_DASHES }} />
    <Key label="budget remaining" className="bg-primary-light" />
    <Key label="cooling down" style={{ backgroundImage: COOLDOWN_HATCH }} />
    <Key label="at rest" className="bg-neutral-100" />
    <Key
      label="budget unknown"
      className="bg-neutral-50"
      style={{ backgroundImage: UNKNOWN_HATCH }}
    />
  </div>
);

export default RackLegend;
