# ADR-0020: Reconcile the two membership-attribution paths by provenance, not by a fourth attribution level

- Status: Accepted
- Date: 2026-08-12
- Relates to: ADR-0006 (untrusted Okta data validated at the boundary),
  ADR-0017 (`unevaluable` is never `no-match`), `docs/security.md` §6

## Context

The app answers "how did this user get into this group?" in two places, and until
this change they could answer it differently for the same person with nothing
saying so.

`shared/utils/membershipAnalysis.ts` opened by declaring itself the **single
source of truth** for membership attribution, shared by the group view and the
user view. That stopped being true when the group path
(`shared/membership/groupSource.ts`) began reading Okta's own
`_embedded['group-rules']` off the member listing
(`GET /api/v1/groups/{id}/users?expand=group-rules`). That embed is
authoritative, costs no extra request, and wins outright — including its
_positive_ "no rule feeds this member" empty-array state.

The user path has no equivalent. `GET /api/v1/users/{id}/groups` returns plain
group objects and carries no attribution embed at all, so
`sidepanel/hooks/useUserMemberships.ts` runs the client-side heuristic alone. The
same user, in the same group, could therefore be reported as rule-managed on the
Groups tab and as a manual add on the Users tab — both rendered with the full
confidence of `attribution: 'exact'`, and with no way for a reader to tell which
screen to believe.

Two shapes of fix were considered:

- **(a) Surface the provenance distinction.** Say which answers are Okta's own
  and which the client deduced, and pin where the two paths are permitted to
  differ.
- **(b) Have the user view consume the group view's cached authoritative answer**
  via `sidepanel/cache/memberSourceCache`.

Auditing the user path for (a) turned up a second, sharper problem. The heuristic
classifies a group as `DIRECT` / `exact` when no active rule targets it — correct
given a complete rule inventory, and a _confidently wrong_ answer without one.
`useUserMemberships` fetched the org's rules, logged a warning on failure, and
then classified against `[]`. A rate-limited or failed rules fetch therefore
rendered every one of the user's groups as "added manually, exactly known": a
fact claim manufactured out of a failed request, and precisely the kind of answer
the group view would contradict.

## Decision

**Keep both mechanisms. Reconcile them by stating _provenance_ alongside the
existing attribution, and pin the reconciliation as an executable contract.**

1. **The invariant is now conditional, and written down as such.**
   `membershipAnalysis` is the single source of truth **only where Okta itself
   said nothing**. The replacement contract is:

   > For a given user and group, the two paths produce the same verdict whenever
   > `readEmbeddedGroupRules` returns `unknown`. Where it does not, the group path
   > is Okta-asserted, the user path is client-evaluated, and the difference is
   > provenance — which the UI states rather than hides.

   `readEmbeddedGroupRules`'s three-state answer is exactly the predicate for "are
   these two views allowed to disagree about this member?"

2. **`shared/membership/attributionParity.test.ts` is the artifact.** It runs one
   user and one group through **both real production functions**
   (`summarizeMemberSources` and `analyzeMemberships`) and compares the verdicts a
   screen would actually show. Its table flags each scenario with whether Okta
   asserted anything; scenarios where Okta was silent are _required_ to match, and
   a separate case asserts the divergence set is **closed** — the only scenarios
   whose verdicts differ are the Okta-asserted ones. Drift between the two paths
   now fails a test instead of shipping as a screen-dependent answer.

3. **Provenance is not a fourth `MembershipAttribution` value.** Okta-asserted and
   client-evaluated-exactly are both `exact` today, and they are genuinely not
   equally strong — but they are not another rung on the same ladder. Attribution
   answers _how strong is the evidence_; provenance answers _who produced it_, and
   the two compose (an Okta assertion is always a fact; a client answer may be a
   fact, an evidenced guess, or no answer). Provenance is already carried beside
   the attribution where the distinction is acted on:
   `RuleMemberCounts.oktaAttributedCount` vs `clientAttributedCount`, which
   `memberSourceBuckets.toRuleAttributionRows` already renders as fact vs
   deduction. If a per-membership provenance is ever needed, it belongs as an
   additive field on `GroupMembership` — not as a widening of the union.

4. **The user path may not claim `exact` without a rule inventory.** A failed
   rules fetch no longer degrades into an analysis: `useUserMemberships`
   distinguishes "the org has no rules" (a successful empty response — still
   `exact`) from "we could not obtain the rules" (`null`), and the latter reports
   `unclassifiedMemberships` — `UNKNOWN` / `ambiguous`, the vocabulary's sanctioned
   "not classified". The degraded result is invalidated out of the entity cache
   immediately so the next visit retries rather than showing "unknown" for the
   whole TTL.

**Option (b) is rejected.** It is not merely risky, it is not implementable as
described: `memberSourceCache` stores a `MemberSourceBreakdown`, which is
aggregate counts — `total`, `direct`, `ruleBased`, per-rule tallies — and carries
**no member ids at all**. The user view cannot ask it "was this user attributed
to this rule?" Making it able to would mean caching per-member attribution for
every analyzed group, and even then the entry only exists for groups an admin
explicitly ran the (expensive, opt-in) analysis on. On top of that the cache has
a 30-minute TTL and no invalidation path — membership mutations do not clear the
derived `['memberSource', groupId]` entry — so consuming it would trade a
disagreement _across screens_ for a disagreement _across time_, where the user
view asserts a rule attribution from a group snapshot up to half an hour stale.
Stale authority reads exactly like fresh authority. Rejected.

## Consequences

- The two views can still differ — deliberately, and only where Okta answered.
  That difference is now a documented property with a test behind it rather than
  an unnoticed defect, and the group view's UI already labels its Okta-attributed
  counts distinctly from its client-inferred ones.
- The user view will show `UNKNOWN` memberships in a case where it previously
  showed confident `DIRECT` ones. That is the point: it is the honest rendering of
  a failed load, and `UNKNOWN` was already a supported display state.
- `unclassifiedMemberships` is additive and available to any future caller that
  loses its inputs. Callers must not cache its result as an analysis.
- The `attribution` union stays at three members, so the two exhaustive tables
  keyed by it (`ATTRIBUTION_SEMANTICS`, `ATTRIBUTION_BUCKET`) and every consumer
  branching on it are untouched. Widening it later remains a compile error at
  every decision point, which is what makes it affordable to reconsider.
- No new API traffic. Neither path gained a request; the user path did not gain a
  per-membership fan-out, and nothing bypasses the background scheduler.
- **Known residual, not fixed here.** `shared/ruleEvaluator` resolves an absent
  profile attribute to `null`, which compares as a definitive `no-match` rather
  than `unevaluable` (pinned by its own tests). A user object with a partial
  profile can therefore be classified `DIRECT` / `exact` on either path. This
  affects the _inputs_ to attribution rather than attribution itself; changing it
  would flip existing evaluator characterization assertions and belongs in its own
  change.
