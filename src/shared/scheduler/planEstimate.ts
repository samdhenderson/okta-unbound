/**
 * @module shared/scheduler/planEstimate
 * @description Turning what the app already knows into a request estimate.
 *
 * Every helper here converts a number the extension has **already paid for** —
 * an `expand=stats` member count, an `x-total-count` header, a persisted
 * `SyncMeta.itemCount`, the length of a fan-out's item list — into the
 * {@link PlanEstimate} a plan leg declares. None of them issues a request, and
 * none of them guesses.
 *
 * That second rule is the load-bearing one. A caller with nothing to go on
 * declares `unknown`, and the bar renders the leg as unquantified rather than
 * folding an invented number into a total the user might act on. A cost display
 * that cannot distinguish a measurement from a guess is worse than one that
 * admits it does not know (ADR-0060 §1).
 *
 * @see `PlanRegistry` — consumes these.
 */

import { OKTA_PAGE_SIZE } from '../utils/oktaPagination';
import type { PlanEstimate } from './plan';

/**
 * Requests a full pagination walk of `itemCount` items will cost.
 *
 * Okta pages at {@link OKTA_PAGE_SIZE}, so the cost is `ceil(n / 200)` — with
 * one deliberate exception: **zero items still costs one request**. The walk has
 * to ask before it can learn the collection is empty, and an estimate of `0`
 * would show a plan that predicted nothing and then spent something.
 *
 * @param itemCount - How many items the collection holds.
 * @returns Page count, minimum 1.
 */
export function pagesFor(itemCount: number): number {
  if (!Number.isFinite(itemCount) || itemCount <= 0) return 1;
  return Math.ceil(itemCount / OKTA_PAGE_SIZE);
}

/**
 * An exact estimate for a walk whose total is already known.
 *
 * Use when the count came free with data the caller already has — an
 * `expand=stats` group member count, an `x-total-count` probe that succeeded, a
 * persisted `SyncMeta.itemCount`. Pass `null` for a total that could not be
 * determined and get `unknown` back rather than a fabricated page count: this is
 * the single place that distinction is made, so no caller has to remember it.
 *
 * @param itemCount - Known item total, or `null` when Okta did not say.
 */
export function walkEstimate(itemCount: number | null | undefined): PlanEstimate {
  if (itemCount === null || itemCount === undefined || !Number.isFinite(itemCount)) {
    return { kind: 'unknown' };
  }
  return { kind: 'exact', requests: pagesFor(itemCount) };
}

/**
 * The opening estimate for a walk of unknown length: one page, and at least one
 * more if this one filled up.
 *
 * A walk that cannot be sized in advance still knows something after its first
 * page, and `atLeast` is how that partial knowledge is stated honestly. The
 * floor rises as pages land (see {@link refinedWalkEstimate}) rather than a
 * total being invented up front and then quietly corrected.
 */
export function openingWalkEstimate(): PlanEstimate {
  return { kind: 'atLeast', requests: 1 };
}

/**
 * The estimate for a walk after `pagesFetched` pages.
 *
 * @param pagesFetched - Pages already requested, including the one just settled.
 * @param hasMore - Whether the `Link` header promised another page.
 * @returns `atLeast pagesFetched + 1` while more pages are promised; `exact
 * pagesFetched` once the walk is done — the moment a floor becomes a fact.
 */
export function refinedWalkEstimate(pagesFetched: number, hasMore: boolean): PlanEstimate {
  const fetched = Math.max(1, Math.floor(pagesFetched));
  return hasMore
    ? { kind: 'atLeast', requests: fetched + 1 }
    : { kind: 'exact', requests: fetched };
}

/**
 * An exact estimate for a fan-out that makes a fixed number of requests per
 * item, which is exact by construction — the item list is in hand.
 *
 * @param itemCount - Items in the fan-out.
 * @param requestsPerItem - Requests each item costs. Defaults to 1.
 */
export function fanOutEstimate(itemCount: number, requestsPerItem = 1): PlanEstimate {
  if (!Number.isFinite(itemCount) || itemCount < 0) return { kind: 'unknown' };
  return { kind: 'exact', requests: Math.floor(itemCount) * Math.max(1, requestsPerItem) };
}

/**
 * A floor for a fan-out whose items cost *at least* `requestsPerItem` each —
 * one whose per-item worker paginates, say, or falls back to a walk.
 *
 * The distinction from {@link fanOutEstimate} is the whole point: a fan-out over
 * a paginating worker knows its minimum exactly and its total not at all, and
 * `atLeast` is the only arm that states both honestly.
 */
export function atLeastFanOutEstimate(itemCount: number, requestsPerItem = 1): PlanEstimate {
  const exact = fanOutEstimate(itemCount, requestsPerItem);
  return exact.kind === 'exact' ? { kind: 'atLeast', requests: exact.requests } : exact;
}
