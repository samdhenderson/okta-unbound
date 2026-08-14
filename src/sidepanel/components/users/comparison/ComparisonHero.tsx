/**
 * @module sidepanel/components/users/comparison/ComparisonHero
 * @description Compact header naming both users, with their overall Jaccard match as a standard overlap bar.
 *
 * ## Why this is a bar and not a split screen
 *
 * The first cut laid the two users out as a `grid-cols-[1fr_auto_1fr]` split screen
 * with the match percentage in a chip between them. In a side panel each `1fr`
 * column is roughly 150px, which is not enough for an avatar plus a label plus a
 * name plus an email — so the chip was pushed out of the panel and the two sides
 * overflowed instead of truncating.
 *
 * The percentage is now rendered in the idiom every other proportion in this
 * extension already uses — a full-width `h-2 rounded-full` track with a filled
 * span (`ComparisonOverviewTab.ProportionStack`, `members/AttributeFacet`'s spread
 * bar) — which has no minimum width to fight over and reads the same as the bars
 * beside it on the Overview tab.
 *
 * The bar itself is `aria-hidden`: it duplicates the percentage rendered as text
 * immediately above it, so nothing here is conveyed by width or colour alone.
 *
 * Display names and emails are end-user-controllable Okta data. They are rendered
 * as React text (escaped), truncate rather than overflow, and carry the untruncated
 * value on `title`; nothing here is logged.
 */
import React from 'react';
import { initialsOf, hueFromId } from '../../../../shared/utils/userDisplay';
import { similarityColor } from './comparisonAnalytics';
import type { OktaUser } from '../../../../shared/types';

/** Props for {@link ComparisonHero}. */
interface ComparisonHeroProps {
  /** The context user (left side). */
  contextUser: OktaUser;
  /** The compared user (right side). */
  comparedUser: OktaUser;
  /** Display name for the context user. */
  contextName: string;
  /** Display name for the compared user. */
  comparedName: string;
  /** Overall similarity as a whole percent (0–100), shown as the bar's fill. */
  similarity: number;
  /**
   * What the percentage actually covers, when that is less than everything —
   * `"groups only"` while the app half could not be read. Appended to the `Match`
   * label so the qualifier travels with the number rather than sitting elsewhere
   * on the page; omitted, the label reads plain `Match`.
   */
  scopeNote?: string;
  /** When true, renders placeholder glyphs instead of the match percentage. */
  isLoading: boolean;
}

/**
 * Comparison header: both users on one line, then the overall match as a labelled
 * percentage over a standard overlap bar.
 *
 * @param props - See {@link ComparisonHeroProps}.
 */
const ComparisonHero: React.FC<ComparisonHeroProps> = ({
  contextUser,
  comparedUser,
  contextName,
  comparedName,
  similarity,
  scopeNote,
  isLoading,
}) => (
  <div className="overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-br from-white via-white to-primary-light/40 p-3">
    <div className="flex items-center gap-2">
      <UserSide user={contextUser} name={contextName} label="Context" />
      <span className="shrink-0 text-sm text-neutral-400" aria-hidden>
        ⇄
      </span>
      <UserSide user={comparedUser} name={comparedName} label="Compared" align="right" />
    </div>

    <div className="mt-3 flex items-baseline justify-between gap-2">
      <span className="min-w-0 truncate text-[10px] font-bold tracking-[0.12em] text-neutral-500 uppercase">
        {isLoading ? '— —' : scopeNote ? `Match · ${scopeNote}` : 'Match'}
      </span>
      <span
        className="font-mono text-sm leading-none font-bold"
        style={{ color: similarityColor(similarity) }}
      >
        {isLoading ? '··' : `${similarity}%`}
      </span>
    </div>

    {/* Same track recipe as the Overview tab's proportion bars. Hidden from the
        accessibility tree: the percentage above is the accessible answer. */}
    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-neutral-100" aria-hidden>
      {!isLoading && (
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(0, Math.min(100, similarity))}%`,
            backgroundColor: similarityColor(similarity),
          }}
        />
      )}
    </div>
  </div>
);

/**
 * One user: a per-user gradient avatar (hue derived from the user id) plus the
 * side's label and display name. Mirrored when `align` is `right`.
 *
 * The email is deliberately not given its own line — at side-panel width it
 * truncated to a few useless characters — but stays reachable as the name's
 * `title`, which is also what recovers a truncated name.
 *
 * The `hsl()` avatar gradient is a documented dynamic-color raw-style exception.
 */
const UserSide: React.FC<{
  user: OktaUser;
  name: string;
  label: string;
  align?: 'left' | 'right';
}> = ({ user, name, label, align = 'left' }) => {
  const hue = hueFromId(user.id);
  const initials = initialsOf(user);
  const isRight = align === 'right';
  const contact = user.profile.email || user.profile.login;

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${isRight ? 'flex-row-reverse text-right' : 'text-left'}`}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white shadow-sm"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue + 40) % 360} 65% 38%))`,
          fontFamily: 'var(--font-heading)',
        }}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-bold tracking-[0.12em] text-neutral-500 uppercase">
          {label}
        </div>
        <div
          className="truncate text-xs font-semibold text-neutral-900"
          title={`${name} — ${contact}`}
        >
          {name}
        </div>
      </div>
    </div>
  );
};

export default ComparisonHero;
