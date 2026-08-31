/**
 * @module shared/scheduler/rateLimitSettings
 * @description The org's own rate-limit warning threshold, and the arithmetic
 * that turns it into the scheduler's cooldown trigger.
 *
 * Okta orgs publish the percentage of a rate limit at which they have asked to
 * be warned — 90 by default for Workforce, 60 for CIAM, and configurable in the
 * Admin Console under Reports → Rate Limits → Settings. `ApiScheduler` used a
 * hardcoded 10%-remaining trigger instead, which is a guess about a number the
 * org had already answered: an org that set its threshold to 60 is saying it
 * wants breathing room this extension was not leaving it.
 *
 * The endpoint is `GET /api/v1/rate-limit-settings/warning-threshold`, whose
 * body is `{"warningThreshold": <int>}`.
 *
 * **Reading it is best-effort by design.** Rate Limit Settings is a Super Admin
 * surface, so an admin with a narrower role gets 403 — a completely normal
 * outcome, not an error worth surfacing. Every unusable answer (403, 404, 401, a
 * body that does not validate, a percentage outside the plausible band) leaves
 * `DEFAULT_CONFIG.minRemainingThreshold` exactly where it was. The org threshold
 * can only ever make the scheduler *better informed*; it can never break it.
 *
 * @see `ApiScheduler.setMinRemainingThreshold`
 * @see {@link https://developer.okta.com/docs/api/openapi/okta-management/management/tag/RateLimitSettings/ | Okta Rate Limit Settings API}
 */

import { z } from 'zod';

/** The org setting this module reads. Same-origin path, GET only. */
export const WARNING_THRESHOLD_ENDPOINT = '/api/v1/rate-limit-settings/warning-threshold';

/**
 * Percentage points subtracted from the org's threshold to get ours.
 *
 * The org's number is where it wants to be *told*; ours is where we want to
 * *stop*. Backing off first means the extension is not the traffic that pushes
 * the org over its own alarm line — so a warning the admin does receive is
 * about something else, which is the only way that alarm stays useful.
 */
export const WARNING_THRESHOLD_MARGIN = 5;

/**
 * The band of `warningThreshold` values this module will act on.
 *
 * Okta's own defaults sit at 60 and 90. A value below the floor would put the
 * cooldown trigger above 95% remaining — the scheduler would refuse to run at
 * all — and a value above 100 is not a percentage. Rather than clamp such a
 * value into range and act on a number the org never set, this treats it as
 * unusable and keeps the configured default. Silently clamping would hide a
 * disagreement between what the org said and what we did.
 */
const MIN_PLAUSIBLE_THRESHOLD = 10;
const MAX_PLAUSIBLE_THRESHOLD = 100;

/**
 * Boundary schema for the endpoint's body (ADR-0006).
 *
 * `passthrough` and a single required field: Okta may add keys, and rejecting a
 * response because it grew one would be a self-inflicted outage. The field is
 * typed as a plain number here — the *plausibility* judgement is
 * {@link parseWarningThreshold}'s, so an out-of-band value is distinguishable
 * from a malformed body if that ever needs separating.
 */
export const warningThresholdSchema = z.object({ warningThreshold: z.number() }).passthrough();

/**
 * The cooldown trigger implied by an org's warning threshold.
 *
 * The org's number counts **consumed** budget; the scheduler's counts what is
 * **left**. So a Workforce default of 90 (warn at 90% consumed) becomes: stop at
 * 85% consumed, which is 15% remaining. A CIAM org's 60 becomes 45% remaining.
 *
 * @param warningThreshold - The org's threshold, as a consumed percentage.
 * @returns The percentage remaining at or below which the scheduler cools down.
 */
export function minRemainingFromWarningThreshold(warningThreshold: number): number {
  return 100 - (warningThreshold - WARNING_THRESHOLD_MARGIN);
}

/**
 * Read a usable `warningThreshold` out of an untrusted response body.
 *
 * @param data - Whatever the endpoint returned.
 * @returns The threshold, or `null` when the body did not validate or the value
 * is outside the band this module will act on. `null` is always "keep the
 * configured default", never "assume something".
 */
export function parseWarningThreshold(data: unknown): number | null {
  const parsed = warningThresholdSchema.safeParse(data);
  if (!parsed.success) return null;

  const { warningThreshold } = parsed.data;
  if (!Number.isFinite(warningThreshold)) return null;
  if (warningThreshold < MIN_PLAUSIBLE_THRESHOLD) return null;
  if (warningThreshold > MAX_PLAUSIBLE_THRESHOLD) return null;
  return warningThreshold;
}
