/**
 * @module sidepanel/hooks/useEntityHandoff
 * @description The offer to bring what the live Okta tab is showing into the panel.
 *
 * Generalised from the Users tab's detected-user banner, which answered exactly
 * this question for exactly one kind: *the admin console has a user open that is
 * not the one you are looking at — want it?* Every other kind had no answer at
 * all, and the one that did spent a full row inside the tab body to ask.
 *
 * Two properties of the banner are preserved deliberately, because they are what
 * made it safe:
 *
 * - **It offers; it never navigates.** Nothing here fetches, selects or switches
 *   tabs on its own. Admin navigation cannot hijack the panel, which is the
 *   whole reason the banner was manual-load only.
 * - **Dismissal is per entity.** Declining hides the offer for *that* entity and
 *   nothing else; pointing the Okta tab at a different one brings it back. A
 *   permanently-dismissed affordance is a dead feature, and a re-nagging one is
 *   worse.
 *
 * ## What it stores
 *
 * Nothing. The dismissal is React state holding one Okta id for the lifetime of
 * the panel session — not `chrome.storage`, which is plaintext and which a
 * durable record of *which people an admin looked at and declined* has no
 * business being in. A session-scoped record is also the correct scope: the
 * question "is this still the same entity as a moment ago" is only meaningful
 * within a session.
 *
 * Nothing in this module logs.
 */
import { useCallback, useState } from 'react';
import type { OktaPageContext, PageType } from './useOktaPageContext';
import type { JumpKind } from './useJumpResolver';

/** The entity the live Okta tab is on, when the panel could open it. */
export interface HandoffOffer {
  /** Which kind, for the glyph and the destination label. */
  kind: JumpKind;
  /** The Okta id the offer would open. */
  id: string;
  /** Display name, as the live page reported it. */
  name: string;
}

/**
 * Narrow a detected page type to a navigable entity kind.
 *
 * Not a second destination mapper — `home/jumpDestinations` owns that, and this
 * function's whole job is to hand it a kind it can accept. The two guards live
 * here: `'admin'` and `'unknown'` are real `PageType`s with **no** entity behind
 * them, and `'rule'` is a real `JumpKind` that no page detection ever produces.
 * Both directions are therefore lossy, and losing them silently is how a
 * shared affordance widens into kinds nothing can honour.
 *
 * @param pageType - The engine's classification of the live Okta tab.
 * @returns The navigable kind, or `null` for a page with no entity.
 */
function handoffKindOf(pageType: PageType): JumpKind | null {
  return pageType === 'admin' || pageType === 'unknown' ? null : pageType;
}

/**
 * The entity the live page is showing, whichever kind it is.
 *
 * Only from a probe that landed: a dead content script means the live page is
 * unknown, which is not the same statement as "it has nothing on it".
 */
function liveEntityOf(page: OktaPageContext): HandoffOffer | null {
  if (page.connectionStatus !== 'connected') return null;
  const kind = handoffKindOf(page.pageType);
  if (kind === null) return null;

  switch (kind) {
    case 'group':
      return page.groupInfo
        ? { kind, id: page.groupInfo.groupId, name: page.groupInfo.groupName }
        : null;
    case 'user':
      return page.userInfo
        ? { kind, id: page.userInfo.userId, name: page.userInfo.userName }
        : null;
    case 'app':
      return page.appInfo ? { kind, id: page.appInfo.appId, name: page.appInfo.appName } : null;
    case 'policy':
      // `policyName` is nullable — Okta's policy page does not always carry one.
      // An offer with no name to show is not an offer, so it is withheld rather
      // than labelled with an id the reader cannot recognise.
      return page.policyInfo?.policyName
        ? { kind, id: page.policyInfo.policyId, name: page.policyInfo.policyName }
        : null;
    // `rule` is unreachable: no page detection produces it. Handled so widening
    // `JumpKind` is a compile error here rather than a silently absent offer.
    default:
      return null;
  }
}

/** Options for {@link useEntityHandoff}. */
export interface UseEntityHandoffOptions {
  /** The panel's one page-context engine result. */
  page: OktaPageContext;
  /**
   * Whether to withhold the offer. Passed `true` while pinned: a pin is a
   * deliberate instruction to stop following the live tab, and the masthead
   * already carries its own *Unpin & switch* hint for that state. Offering both
   * at once would be two controls for one decision.
   */
  suppressed: boolean;
  /**
   * Whether the panel can currently open that kind at all. `EntityLink`'s
   * `canNavigateTo` in prop form — the shared affordance must not widen past
   * what the build can honour, and `navigationHandlers` and `isLivePinnable`
   * cover different sets.
   */
  canNavigateTo: (kind: JumpKind) => boolean;
  /** Open the entity on its own tab. Fired only from an explicit press. */
  navigateTo: (kind: JumpKind, id: string) => void;
}

/** Return shape of {@link useEntityHandoff}. */
export interface UseEntityHandoffReturn {
  /** The offer to render, or `null` when there is nothing to hand over. */
  offer: HandoffOffer | null;
  /** Take the offer: open the entity here. */
  accept: () => void;
  /** Decline it, for this entity only. */
  dismiss: () => void;
}

/**
 * Resolve whether to offer the live Okta tab's entity, and what accepting means.
 *
 * @param options - See {@link UseEntityHandoffOptions}.
 * @returns The current offer plus its two verbs. See {@link UseEntityHandoffReturn}.
 */
export function useEntityHandoff({
  page,
  suppressed,
  canNavigateTo,
  navigateTo,
}: UseEntityHandoffOptions): UseEntityHandoffReturn {
  // One id: the entity whose offer has already been answered, either way. A
  // different id is a different question, so the offer returns on its own.
  const [handledId, setHandledId] = useState<string | null>(null);

  const live = liveEntityOf(page);
  const offer =
    live !== null && !suppressed && live.id !== handledId && canNavigateTo(live.kind) ? live : null;

  const accept = useCallback(() => {
    if (offer === null) return;
    setHandledId(offer.id);
    navigateTo(offer.kind, offer.id);
  }, [offer, navigateTo]);

  const dismiss = useCallback(() => {
    if (offer === null) return;
    setHandledId(offer.id);
  }, [offer]);

  return { offer, accept, dismiss };
}
