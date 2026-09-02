/**
 * @module sidepanel/hooks/useSessionExpiry
 * @description Whether the Okta session behind the tab the panel is driving has
 * expired, read from the one place that knows: the background scheduler.
 *
 * A 401 is a property of the *session*, not of a request (ADR-0054), so it is
 * detected once by `ApiScheduler` — which is the only layer that sees every
 * request and can decline to send the next one — and published on
 * `SchedulerState.expiredSessionTabIds`. This hook is the panel's read of that,
 * and it exists so exactly **one** banner renders instead of a failed-request
 * error state on every mounted surface. (`D-007b`)
 */

import { useScheduler } from '../contexts/SchedulerContext';

/**
 * Has the Okta session for `targetTabId` expired?
 *
 * @param targetTabId - The Okta tab the panel is driving, or `null` when no tab
 * has been detected. A `null` tab is never reported as expired: nothing is known
 * about a session the panel is not talking to, and saying otherwise would put a
 * sign-in prompt in front of an admin whose only problem is that no Okta tab is
 * open.
 * @returns `true` only while the scheduler is holding requests for that tab.
 * @remarks Recovery needs no call here. The scheduler clears the tab from its
 * published state as soon as a request for it succeeds, so the banner unmounts
 * on the same broadcast that resumes normal scheduling.
 */
export function useSessionExpiry(targetTabId: number | null): boolean {
  const { state } = useScheduler();
  if (targetTabId === null) return false;
  return (state?.expiredSessionTabIds ?? []).includes(targetTabId);
}
