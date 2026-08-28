/**
 * @module sidepanel/hooks/useActorNotice
 * @description Tells the admin, once and non-blockingly, that an audited
 * operation could not name them.
 *
 * `D-013a`/`D-013b` stopped the audit trail from inventing an identity: an
 * operation whose `getCurrentUser()` lookup comes back `kind: 'unavailable'` is
 * recorded as `performedBy: null` / `actorResolution: 'unavailable'`. `D-013c`
 * closes the loop by telling the admin *at the time*, so the labelled gap is not
 * first discovered months later in a CSV export.
 *
 * The notice is deliberately inert: it never blocks, confirms, or aborts the
 * write — refusing a legitimate admin action over a failed metadata lookup is a
 * worse failure than a labelled gap (`D-013`). It renders through the existing
 * shared `AlertMessage` surface as a `warning` (a degraded outcome, not a
 * failure — ADR-0002 status vocabulary), driven by the same
 * `AlertMessageData | null` state pattern the Users tab uses for its result
 * banner.
 */

import { useCallback, useState } from 'react';
import type { AlertMessageData } from '../components/shared/AlertMessage';
import type { Actor } from './useOktaApi/core';

/**
 * The exact copy shown when the acting admin could not be resolved. Shared by
 * every audited flow so all three say the same thing (`D-013c`).
 */
export const ACTOR_UNAVAILABLE_TEXT =
  "Couldn't confirm your signed-in identity. This action will be recorded without an actor.";

/**
 * The actor-unavailable notice as {@link AlertMessageData}, ready to hand to
 * `AlertMessage`. `warning`, not `danger`: the operation still went through.
 */
export const ACTOR_UNAVAILABLE_NOTICE: AlertMessageData = {
  text: ACTOR_UNAVAILABLE_TEXT,
  type: 'warning',
};

/** Return shape of {@link useActorNotice}. */
export interface UseActorNoticeReturn {
  /** The notice to render, or `null` when the actor is known (or nothing has run yet). */
  actorNotice: AlertMessageData | null;
  /**
   * Record what the actor lookup answered for the operation about to run.
   * An `unavailable` actor raises the notice; a `resolved` one clears any
   * notice left over from an earlier run.
   */
  noteActor: (actor: Actor) => void;
  /** Dismiss the notice (wired to `AlertMessage`'s × button). */
  dismissActorNotice: () => void;
}

/**
 * Track whether the current operation's actor could be resolved, exposing the
 * admin-facing notice for the unresolved case.
 *
 * @returns `{ actorNotice, noteActor, dismissActorNotice }` — see
 * {@link UseActorNoticeReturn}.
 *
 * @example
 * ```ts
 * const { actorNotice, noteActor, dismissActorNotice } = useActorNotice();
 * const actor = await getCurrentUser();
 * noteActor(actor); // never awaited on, never blocks the write below
 * ```
 */
export function useActorNotice(): UseActorNoticeReturn {
  const [actorNotice, setActorNotice] = useState<AlertMessageData | null>(null);

  const noteActor = useCallback((actor: Actor) => {
    setActorNotice(actor.kind === 'resolved' ? null : ACTOR_UNAVAILABLE_NOTICE);
  }, []);

  const dismissActorNotice = useCallback(() => setActorNotice(null), []);

  return { actorNotice, noteActor, dismissActorNotice };
}
