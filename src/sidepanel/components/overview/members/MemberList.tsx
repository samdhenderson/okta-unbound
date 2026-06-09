import React, { useEffect, useRef } from 'react';
import type { OktaUser, MemberMfaResult } from '../../../../shared/types';
import ScrollableList from '../../shared/ScrollableList';
import MemberRow from './MemberRow';

interface MemberListProps {
  members: OktaUser[]; // already filtered
  mfaResults: Map<string, MemberMfaResult> | null;
  mfaScanned: boolean;
  visibleCount: number;
  onLoadMore: () => void;
  oktaOrigin?: string | null;
}

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
      { rootMargin: '120px' }
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
          <button
            type="button"
            onClick={onLoadMore}
            className="px-3 py-1.5 rounded-md border border-neutral-200 font-medium text-neutral-700 hover:bg-neutral-50 hover:border-neutral-500 transition-colors duration-100"
          >
            Load more (+{Math.min(PAGE, members.length - visibleCount)})
          </button>
        )}
      </div>
    </div>
  );
};

export default MemberList;
