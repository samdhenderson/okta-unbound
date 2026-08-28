/**
 * @module sidepanel/components/home/OrgSnapshotCard
 * @description The Home tab's third region: how big this org is.
 *
 * Four figures, all read from the background-owned org snapshot (ADR-0040), so
 * a warm org renders them at **zero requests**. The counts are `rows.length`
 * over collections the background already walked.
 *
 * ## Every figure states its own age
 *
 * The footnote is not decoration. A cached number with no stated age *is* a
 * cached number presented as current, which is the thing this repo's ledger
 * bans — so the card quotes the oldest walk behind it and offers a Refresh that
 * forces a real one. What it never does is claim freshness it does not have:
 * with any collection unwalked, `readAt` is `null` and the line is omitted
 * rather than guessed.
 *
 * The four states a figure can be in, and why a `0` is never a stand-in for
 * "unknown", live in {@link module:sidepanel/components/home/orgFigures}.
 */
import React from 'react';
import Eyebrow from '../shared/Eyebrow';
import Button from '../shared/Button';
import Icon from '../shared/Icon';
import Skeleton from '../shared/Skeleton';
import StatCard from '../shared/StatCard';
import { getRelativeTime } from '../../../shared/utils/dateFormat';
import type { OrgFigure } from './orgFigures';

/** Props for {@link OrgSnapshotCard}. */
export interface OrgSnapshotCardProps {
  /** The four figures, in display order. */
  figures: OrgFigure[];
  /** Epoch millis of the oldest finished walk, or `null` when there is none. */
  readAt: number | null;
  /** Whether a refresh is in flight. */
  isRefreshing: boolean;
  /** Force a full walk. */
  onRefresh: () => void;
  /** Whether a refresh can be issued (needs a connected Okta tab). */
  canRefresh: boolean;
}

/** One figure, in whichever of its four states it is in. */
const Figure: React.FC<{ figure: OrgFigure }> = ({ figure }) => {
  if (figure.status === 'reading') {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <Skeleton variant="text" width="w-1/2" label={`Reading ${figure.label.toLowerCase()}`} />
        <div className="mt-2">
          <Skeleton variant="text" size="lg" width="w-1/3" />
        </div>
      </div>
    );
  }

  if (figure.value === null) {
    // No number, and no pretence of one. The sentence says what is known and
    // stops there.
    return (
      <div className="rounded-lg border border-dashed border-neutral-200 bg-white p-4">
        <Eyebrow className="block">{figure.label}</Eyebrow>
        <p className="mt-2 flex items-start gap-2 text-xs text-neutral-600">
          <Icon type={figure.icon} size="sm" className="mt-0.5 shrink-0 text-neutral-400" />
          <span>{figure.note}</span>
        </p>
      </div>
    );
  }

  return (
    <StatCard
      title={figure.label}
      value={figure.value}
      icon={figure.icon}
      subtitle={figure.note}
      color={figure.status === 'partial' ? 'warning' : 'neutral'}
      countUp
    />
  );
};

/**
 * Render the org snapshot card.
 *
 * @param props - See {@link OrgSnapshotCardProps}.
 */
const OrgSnapshotCard: React.FC<OrgSnapshotCardProps> = ({
  figures,
  readAt,
  isRefreshing,
  onRefresh,
  canRefresh,
}) => {
  const age = readAt === null ? null : getRelativeTime(new Date(readAt).toISOString());

  return (
    <section aria-label="This org" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow as="h3">This org</Eyebrow>
        <Button
          variant="secondary"
          size="sm"
          icon="refresh"
          onClick={onRefresh}
          loading={isRefreshing}
          disabled={!canRefresh}
        >
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {figures.map((figure) => (
          <Figure key={figure.key} figure={figure} />
        ))}
      </div>

      {/*
        Omitted rather than guessed when some collection has never been walked:
        a number with an invented age is worse than a number with none.
      */}
      {age && <p className="text-xs text-neutral-600">Counts as Okta reports them · read {age}</p>}
    </section>
  );
};

export default OrgSnapshotCard;
