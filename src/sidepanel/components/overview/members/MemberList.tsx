/**
 * @module sidepanel/components/overview/members/MemberList
 * @description Windowed, auto-paging scrollable list of member rows.
 *
 * Mounts only the first `visibleCount` rows and grows via a "Load more" footer and
 * an IntersectionObserver sentinel, capping DOM size for very large groups.
 */
import React, { useEffect, useRef } from 'react';
import type { OktaUser, MemberMfaResult } from '../../../../shared/types';
import ScrollableList from '../../shared/ScrollableList';
import { Button } from '../../shared';
import MemberRow from './MemberRow';

/** Props for {@link MemberList}. */
interface MemberListProps {
  /** Members to display, already filtered and sorted by the caller. */
  members: OktaUser[];
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
  mfaResults,
  mfaScanned,
  visibleCount,
  onLoadMore,
  oktaOrigin,
}) => {
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

  if (members.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-neutral-500">
        No members match the current search and filters.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <ScrollableList maxHeight="50vh" fillAvailable={false}>
        {visible.map((user) => (
          <MemberRow
            key={user.id}
            user={user}
            mfa={mfaResults?.get(user.id)}
            mfaScanned={mfaScanned}
            oktaOrigin={oktaOrigin}
          />
        ))}
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
