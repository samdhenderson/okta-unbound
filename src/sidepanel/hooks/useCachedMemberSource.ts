/**
 * @module sidepanel/hooks/useCachedMemberSource
 * @description Read-only subscription to a group's cached member-source breakdown.
 *
 * The deliberate counterpart to
 * {@link module:sidepanel/hooks/useGroupSource}: that hook *computes* the
 * manual-vs-rule split (an expensive, explicitly gated paginated member read);
 * this one only ever *reads* what has already been computed and re-renders when
 * it lands.
 *
 * It takes no `targetTabId` and imports no API surface, so a consumer — every row
 * in a 5000-group list — structurally cannot trigger a fetch. That is the whole
 * point: rendering a meter must never cost a request.
 */

import { useEffect, useState } from 'react';
import { readMemberSource, subscribeMemberSource } from '../cache/memberSourceCache';
import type { MemberSourceBreakdown } from '../../shared/membership/groupSource';

/**
 * Subscribe to the session-cached member-source breakdown for one group.
 *
 * @param groupId - The Okta group id to watch.
 * @returns The cached breakdown, or `null` when none has been computed this
 *   session (or it has passed its TTL). Never fetches.
 */
export function useCachedMemberSource(groupId: string): MemberSourceBreakdown | null {
  const [breakdown, setBreakdown] = useState<MemberSourceBreakdown | null>(() =>
    readMemberSource(groupId),
  );

  useEffect(() => {
    // Re-read on id change as well as on notification: a recycled row may point
    // at a different group than the one the initial state was seeded from.
    setBreakdown(readMemberSource(groupId));
    return subscribeMemberSource(groupId, () => setBreakdown(readMemberSource(groupId)));
  }, [groupId]);

  return breakdown;
}
