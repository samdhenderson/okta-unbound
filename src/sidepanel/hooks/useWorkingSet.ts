/**
 * @module sidepanel/hooks/useWorkingSet
 * @description Read side of the Home tab's working set: what is pinned, what was
 * recently open, and the two writes a reader can make.
 *
 * Home is the only consumer of the list; the pin toggle is also used by the
 * Groups and Users headers, which need `isPinned` and `togglePin` but not the
 * rows. Both come from here so there is one subscription per surface rather than
 * one per row.
 *
 * ## One storage listener, deliberately
 *
 * ADR-0018's shared-listener rule exists because nine mounted tabs each
 * registering the same listener is nine times the work for one answer. That is
 * not the shape here: a `chrome.storage.onChanged` subscription costs no Okta
 * traffic, and it is what lets Home reflect a drill-in that happened while Home
 * was hidden — without it, pinning a group on the Groups tab would leave Home
 * showing yesterday's list until the panel was reopened.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  workingSetStore,
  EMPTY_WORKING_SET,
  type WorkingSet,
  type WorkingSetKind,
  type WorkingSetRef,
} from '../../shared/storage/workingSetStore';

/** What {@link useWorkingSet} exposes. */
export interface UseWorkingSetResult {
  /** Entities the reader chose to keep. */
  pinned: WorkingSetRef[];
  /** Entities recently opened, most recent first. */
  recent: WorkingSetRef[];
  /** `true` until the first read settles, so a cold panel can hold its copy. */
  isReading: boolean;
  /** Whether one entity is currently pinned. */
  isPinned: (kind: WorkingSetKind, id: string) => boolean;
  /** Pin an entity, or release it if it is already pinned. */
  togglePin: (ref: Omit<WorkingSetRef, 'lastSeenAt'>) => void;
  /** Drop an entity from both lists. */
  forget: (kind: WorkingSetKind, id: string) => void;
}

/**
 * Subscribe to one org's working set.
 *
 * @param origin - Okta org origin. `null` reads nothing rather than another
 * org's rows, and both writes become no-ops.
 * @returns See {@link UseWorkingSetResult}.
 *
 * @example
 * ```tsx
 * const workingSet = useWorkingSet(oktaOrigin);
 * <WorkingSetPinButton
 *   pinned={workingSet.isPinned('group', group.id)}
 *   onToggle={() => workingSet.togglePin({ kind: 'group', id: group.id, name: group.name })}
 * />
 * ```
 */
export function useWorkingSet(origin: string | null | undefined): UseWorkingSetResult {
  const [set, setSet] = useState<WorkingSet>(EMPTY_WORKING_SET);
  const [isReading, setIsReading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsReading(true);
    // Blank the previous org's rows immediately rather than after the read: a
    // name from the org you just left must not linger under the new one's
    // identity, even for a frame.
    setSet(EMPTY_WORKING_SET);
    void workingSetStore
      .read(origin)
      .then((stored) => {
        if (!cancelled) setSet(stored);
      })
      .finally(() => {
        if (!cancelled) setIsReading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [origin]);

  // Repaint when any surface writes — including a drill-in recorded on another
  // tab while Home was hidden.
  useEffect(() => {
    if (!origin) return;
    return workingSetStore.subscribe((file) => setSet(workingSetStore.select(file, origin)));
  }, [origin]);

  const isPinned = useCallback(
    (kind: WorkingSetKind, id: string) =>
      set.pinned.some((entry) => entry.kind === kind && entry.id === id),
    [set.pinned],
  );

  const togglePin = useCallback(
    (ref: Omit<WorkingSetRef, 'lastSeenAt'>) => {
      // Applied optimistically as well as persisted: the storage broadcast does
      // not fire in the page that wrote it, so waiting for it would leave the
      // button unpressed until the next unrelated change.
      void workingSetStore.togglePin(origin, ref).then(setSet);
    },
    [origin],
  );

  const forget = useCallback(
    (kind: WorkingSetKind, id: string) => {
      void workingSetStore.forget(origin, { kind, id }).then(setSet);
    },
    [origin],
  );

  return { pinned: set.pinned, recent: set.recent, isReading, isPinned, togglePin, forget };
}
