/**
 * @module shared/membership/memberRuleAttribution
 * @description Okta's **own** per-member rule attribution, read off the group
 * membership listing.
 *
 * `GET /api/v1/groups/{id}/users?expand=group-rules` is what the Okta admin
 * console itself uses to fill its "assigned by rule" column: each member row
 * comes back with `_embedded['group-rules']` — an array of `{ id, name }` rule
 * references. It is the same request the app already makes to list members, so
 * the attribution costs **zero extra requests** and needs no join against the
 * org's rules payload.
 *
 * This is authoritative where `shared/utils/membershipAnalysis` only guesses, so
 * it is the *primary* source for {@link module:shared/membership/groupSource}.
 * The heuristic remains the fallback and must not be removed: `expand=group-rules`
 * is a private, undocumented admin-console parameter, so any org/version that
 * does not honour it simply lands on the old behaviour.
 *
 * **Three states, never two.** The embed distinguishes "Okta says no rule feeds
 * this member" (an empty array — an authoritative *manual* add) from "Okta told
 * us nothing" (the key is absent — fall back to the heuristic). Collapsing them
 * either way is precisely the mis-reporting this module exists to remove; see
 * {@link MemberRuleAttribution}.
 *
 * **This module is the seam where the two views may legitimately diverge.** The
 * user view has no equivalent embed to read, so `unknown` is the only state it
 * ever sees *by default*. That makes {@link readEmbeddedGroupRules}'s answer the
 * exact predicate for "are the group and user views allowed to disagree about
 * this member?" — `unknown` means no, anything else means
 * yes-and-for-a-stated-reason (ADR-0020, pinned by `attributionParity.test.ts`).
 *
 * **The user view can now leave `unknown`, but only when asked to.** ADR-0031
 * adds an explicit, per-membership read
 * (`GET /api/v1/groups/{groupId}/users/{userId}/group-rules`) behind a click, so
 * a reader can convert one hedged guess into Okta's own answer. That endpoint
 * returns the rule references directly rather than nested under `_embedded`, so
 * it shares this module's *interpretation* ({@link interpretGroupRules}) rather
 * than its unwrapping — the three states, and the refusal to collapse them, are
 * defined once for both callers.
 *
 * @see {@link readEmbeddedGroupRules}
 * @see {@link interpretGroupRules}
 */

import { z } from 'zod';
import { oktaUserListItemSchema } from '../schemas/okta';

/**
 * The `expand` value that makes Okta embed each member's feeding rules.
 *
 * Exported so the request builder and the reader can never drift: the key Okta
 * nests the result under is the **hyphenated** `group-rules`, not `groupRules`.
 */
export const GROUP_RULES_EXPAND = 'group-rules';

/**
 * Group-member row schema: {@link oktaUserListItemSchema} plus the `_embedded`
 * block that `expand=group-rules` adds.
 *
 * Extended **locally** rather than teaching the shared schema about a narrow,
 * single-endpoint concern — the same call as
 * `sidepanel/export/descriptors/groups.ts`'s `groupWithStatsSchema`.
 *
 * `_embedded` is `z.unknown()` and never a `z.object`, following the
 * {@link oktaAppListItemSchema} precedent, and that is load-bearing:
 * `parseOktaList` **drops** a row that fails validation (ADR-0006, "degrade,
 * never crash"), so a stricter `_embedded` would let one malformed embed delete
 * a real person from a group's membership. Under-reporting membership is worse
 * than the mis-attribution this whole change fixes. Readers validate what they
 * pull out of it instead — see {@link readEmbeddedGroupRules}.
 */
export const memberWithGroupRulesSchema = oktaUserListItemSchema.extend({
  _embedded: z.unknown().optional(),
});

/** A validated group-member row, possibly carrying the `group-rules` embed. */
export type MemberWithGroupRules = z.infer<typeof memberWithGroupRulesSchema>;

/** A rule reference as Okta embeds it against a member. */
export interface EmbeddedGroupRule {
  /** Rule id (`0pr…` — a rule id, *not* a group id). */
  id: string;
  /** Rule name, exactly as Okta returned it. */
  name: string;
}

/**
 * Per-entry shape. Only `id` and `name` are required — everything else Okta may
 * add passes through — and entries are validated one at a time so a single
 * malformed sibling cannot discard a usable attribution.
 */
const embeddedGroupRuleSchema = z.object({ id: z.string(), name: z.string() }).passthrough();

/**
 * What the embed says about one member — **three** distinct states.
 *
 * - `rules` — Okta named the feeding rule(s). Authoritative; two or more entries
 *   is a genuine multi-rule member, not an error.
 * - `no-rules` — Okta positively asserted that *no* rule feeds this member: an
 *   authoritative manual (DIRECT) add. **An empty array is not "unknown".**
 * - `unknown` — Okta told us nothing (key absent, or the embed was malformed).
 *   The caller must fall back to the client-side heuristic for this member.
 */
export type MemberRuleAttribution =
  { state: 'rules'; rules: EmbeddedGroupRule[] } | { state: 'no-rules' } | { state: 'unknown' };

/** Shared instance for the (common) unknown answer. */
const UNKNOWN: MemberRuleAttribution = { state: 'unknown' };

/**
 * Read Okta's rule attribution out of one group-member row.
 *
 * Pure, total, and side-effect free — the argument is typed `unknown` because
 * {@link memberWithGroupRulesSchema} deliberately does not constrain `_embedded`.
 * Every failure mode (absent, `null`, a string, a non-array `group-rules`, an
 * array of unusable entries) degrades to `unknown` so the caller falls back to
 * the heuristic. It never throws and never drops the member.
 *
 * @param member - A raw group-member row from the membership listing.
 * @returns The member's {@link MemberRuleAttribution}. Duplicate rule ids are
 * collapsed, so a member is credited to each distinct rule at most once.
 */
export function readEmbeddedGroupRules(member: unknown): MemberRuleAttribution {
  if (typeof member !== 'object' || member === null) return UNKNOWN;

  const embedded = (member as Record<string, unknown>)._embedded;
  if (typeof embedded !== 'object' || embedded === null) return UNKNOWN;

  // Key absent → Okta said nothing. Distinct from an empty array, which is a
  // positive "no rule feeds this member".
  if (!(GROUP_RULES_EXPAND in embedded)) return UNKNOWN;

  return interpretGroupRules((embedded as Record<string, unknown>)[GROUP_RULES_EXPAND]);
}

/**
 * Interpret a bare list of rule references — the three-state reading, without the
 * `_embedded` unwrapping.
 *
 * Shared by the two ways Okta will answer "which rules manage this membership":
 * the `expand=group-rules` embed on the group-member listing
 * ({@link readEmbeddedGroupRules}) and the per-membership endpoint
 * `GET /api/v1/groups/{groupId}/users/{userId}/group-rules`, whose body **is**
 * this array (ADR-0031). Keeping the interpretation in one place is what stops
 * the second caller from quietly reading an empty answer as no answer.
 *
 * Pure and total: anything that is not an array of usable rule references
 * degrades to `unknown`, never to `no-rules`.
 *
 * @param raw - The rule-reference array, exactly as Okta sent it.
 * @returns The corresponding {@link MemberRuleAttribution}. An **empty array is
 * `no-rules`** — Okta positively asserting a manual add — while a non-array, or
 * an array whose every entry is unusable, is `unknown`. Duplicate rule ids are
 * collapsed.
 */
export function interpretGroupRules(raw: unknown): MemberRuleAttribution {
  if (!Array.isArray(raw)) return UNKNOWN;
  if (raw.length === 0) return { state: 'no-rules' };

  const rules: EmbeddedGroupRule[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const parsed = embeddedGroupRuleSchema.safeParse(entry);
    if (!parsed.success || seen.has(parsed.data.id)) continue;
    seen.add(parsed.data.id);
    rules.push({ id: parsed.data.id, name: parsed.data.name });
  }

  // Okta claimed rules but named none we can use: that is "we don't know",
  // never "no rule" — fall back rather than invent a confident manual add.
  if (rules.length === 0) return UNKNOWN;

  return { state: 'rules', rules };
}
