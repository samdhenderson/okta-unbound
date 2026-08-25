/**
 * @module sidepanel/components/members/MemberList
 * @description Windowed, auto-paging scrollable list of member rows.
 *
 * Mounts only the first `visibleCount` rows and grows via a "Load more" footer and
 * an IntersectionObserver sentinel, capping DOM size for very large groups.
 *
 * Rows enter through the shared `.rise-in-stagger` wrapper, driven by
 * `useStaggerReveal`: rows hold until they scroll into view, then cascade with the
 * batch they arrived in, stepping `min(24ms, 320ms / gaps)` so the whole cascade
 * fits one `--dur-travel` however tall the viewport. The entrance is wired through
 * the wrapper rather than a per-row index prop, so {@link MemberRow} needs no index
 * and its memo comparator is untouched. A reload swaps the rows for
 * `Skeleton variant="row"` placeholders — the shape is known, so there is nothing
 * for a spinner to explain — and the hook re-arms on the container that comes back.
 */
import React, { useEffect, useRef } from 'react';
import { useStaggerReveal } from '../../hooks/useStaggerReveal';
import type { OktaUser, MemberMfaResult } from '../../../shared/types';
import ScrollableList from '../shared/ScrollableList';
import { Button, Skeleton } from '../shared';
import MemberRow from './MemberRow';

/** Props for {@link MemberList}. */
interface MemberListProps {
  /** Members to display, already filtered and sorted by the caller. */
  members: OktaUser[];
  /**
   * True while the member set is being re-fetched, replacing the rows with
   * skeleton placeholders. Defaults to `false`.
   */
  loading?: boolean;
  /** Per-member MFA scan results, or null before a scan has run. */
  mfaResults: Map<string, MemberMfaResult> | null;
  /** True once a scan completed, so rows can render "No MFA" for 0-factor users. */
  mfaScanned: boolean;
  /** How many rows are currently mounted. */
  visibleCount: number;
  /** Reveal the next page of rows. */
  onLoadMore: () => void;
  /** Okta org origin for per-member Admin Console links (null when unknown). */
  oktaOrigin?: string | null;
}

/** Number of additional rows revealed per "Load more". */
const PAGE = 50;

/**
 * Scrollable member list that only mounts the first `visibleCount` rows, with a
 * "Load more" footer plus an IntersectionObserver sentinel for auto-paging on
 * scroll. This caps DOM size regardless of group size (up to ~64k members).
 */
const MemberList: React.FC<MemberListProps> = ({
  members,
  loading = false,
  mfaResults,
  mfaScanned,
  visibleCount,
  onLoadMore,
  oktaOrigin,
}) => {
  const setStaggerRef = useStaggerReveal();

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasMore = visibleCount < members.length;
  const visible = members.slice(0, visibleCount);

  // Auto-load more when the sentinel scrolls into view.
  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin: '120px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  if (!loading && members.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-neutral-500">
        No members match the current search and filters.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <ScrollableList
        maxHeight="50vh"
        fillAvailable={false}
        loading={loading}
        skeleton={<Skeleton variant="row" size="md" count={6} label="Reloading members" />}
      >
        {/* One stagger wrapper around the rows: `.rise-in-stagger > *` drives the
            entrance, so newly paged-in rows animate and already-mounted ones stay
            put. The sentinel stays outside it — it must never be delayed. */}
        <div ref={setStaggerRef} className="space-y-3 rise-in-stagger">
          {visible.map((user) => (
            <MemberRow
              key={user.id}
              user={user}
              mfa={mfaResults?.get(user.id)}
              mfaScanned={mfaScanned}
              oktaOrigin={oktaOrigin}
            />
          ))}
        </div>
        {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
      </ScrollableList>

      <div className="flex items-center justify-between pt-3 text-xs text-neutral-500">
        <span>
          Showing {visible.length.toLocaleString()} of {members.length.toLocaleString()}
        </span>
        {hasMore && (
          <Button variant="secondary" size="sm" onClick={onLoadMore}>
            Load more (+{Math.min(PAGE, members.length - visibleCount)})
          </Button>
        )}
      </div>
    </div>
  );
};

export default MemberList;
