# ADR-0031: Prove one membership against Okta, on demand, as provenance

- Status: Accepted
- Date: 2026-08-14
- Amends: ADR-0020 (the parity predicate it states, not its decisions)
- Relates to: ADR-0006 (untrusted Okta data validated at the boundary),
  ADR-0012 (no test weakened here), `docs/security.md` §6

## Context

ADR-0020 left the user-detail page hedging. The group view reads Okta's own
per-member attribution off `_embedded['group-rules']`; the user view has no such
embed on `GET /api/v1/users/{id}/groups`, so it runs the client-side heuristic
alone and every sentence it shows is a deduction. `memberRuleAttribution`'s own
module doc recorded the gap: "the user view has no equivalent embed to read, so
`unknown` is the only state it ever sees."

That is no longer the whole truth. Okta documents a per-membership endpoint:

```
GET /api/v1/groups/{groupId}/users/{userId}/group-rules
```

One call, one membership, authoritative — the same books the embed is read from,
asked one row at a time. It answers exactly the question the user-detail row is
guessing at.

The cost is what kept it out. It is **linear in group count**: a user in forty
groups is forty requests, so running it for a list would spend an admin's rate
limit answering a question nobody asked.

ADR-0020 already rejected a _different_ way of closing this gap — **(b)**, having
the user view consume the group view's cached `memberSourceCache` aggregate. That
rejection stands and is not reopened here: that cache holds no member ids at all,
only counts, so it cannot answer "was this user attributed to this rule?"; it
exists only for groups an admin explicitly analyzed; and its 30-minute TTL has no
invalidation path, so "stale authority reads exactly like fresh authority".

## Decision

**Add a per-row, user-initiated "Prove it" action that converts one hedged guess
into Okta's own answer, and carry that answer as provenance.**

1. **Explicit, per row, never automatic.** The read is gated behind a click, one
   membership at a time. Nothing runs on mount, on tab activation, or for a list.
   This is what distinguishes it from ADR-0020's rejected option (b): the answer
   is fresh at the moment it is shown, it is about this exact member, and it is
   spent only when a reader asks for it.

2. **The shape is ADR-0020 §3's, verbatim: an additive field on
   `GroupMembership`.** `MembershipProvenance` (`{ source: 'okta'; rules }`) sits
   beside `membershipType` / `rules` / `attribution` and rewrites none of them.
   The `MembershipAttribution` union stays at three members, so the exhaustive
   tables keyed by it (`ATTRIBUTION_SEMANTICS`, `ATTRIBUTION_BUCKET`) and every
   consumer branching on it are untouched. **Provenance is still not a fourth
   attribution level.**

   Okta's answer names rules; it does not describe them. Over-writing the
   classifier's `rules` with bare `{ id, name }` references would destroy the
   evaluable rules the row explains clause by clause, so the two answers sit side
   by side and the surface states which is which.

3. **Three states, still three.** The endpoint's body is interpreted by
   `interpretGroupRules` — extracted from `readEmbeddedGroupRules` so both callers
   share one reading. A populated list is `rules`; an **empty** list is `no-rules`,
   Okta positively asserting a manual add; a failed request, or a body that is not
   a rule list, is `unknown` — and `unknown` attaches **no provenance at all**.
   Collapsing the last two would manufacture a confident "added directly" out of a
   failed request, which is the defect ADR-0020 §4 removed from this path.

4. **The parity predicate changes, and is re-pinned.** ADR-0020's contract keyed
   the permitted divergence on `readEmbeddedGroupRules` returning `unknown`,
   which was safe only while the user path could never see anything else. The
   replacement contract is strictly narrower:

   > For a given user and group, the two paths produce the same verdict whenever
   > Okta asserted nothing. Where Okta asserted something they differ **until the
   > user path is proven**, and a proven user path reproduces the group path's
   > verdict — because both are then reading the same answer.

   `shared/membership/attributionParity.test.ts` is extended, not edited: its
   existing table and both closure tests stand unchanged, and a new suite runs
   every `oktaAsserts` scenario through the proof and asserts the verdicts
   converge (and that they diverged beforehand, so the suite cannot pass
   vacuously).

5. **It rides the normal transport.** `getMembershipRuleProof` is an operation on
   the existing group-member module and goes through `coreApi.makeApiRequest`,
   i.e. the background scheduler, like every other Okta call. No new message
   action, no new permission, nothing cached or persisted. Failures log the group
   id, user id and status — identifiers and outcomes, never the body.

## Consequences

- A reader on the user-detail page can settle any single row, and the row then
  says whose answer it is showing: "Okta confirms: …" is a fact, everything else
  is still the classifier's deduction. The wording comes from
  `shared/membership/sourceLine`, so the comparison's diff row inherits the same
  vocabulary for free if it is ever given a proof.
- The two screens can still disagree, but the disagreement is now **resolvable**
  rather than merely explained. That is the substantive change to ADR-0020's
  posture, and the reason this is an amendment rather than a footnote.
- API cost is opt-in and visible: one request per press. Nothing fans out, and a
  user with forty groups still costs one request until someone asks a fortieth
  time.
- `provenance` is optional and additive, so every existing producer of a
  `GroupMembership` keeps compiling and keeps meaning what it meant. Consumers
  that ignore it render exactly as before.
- **Not done here.** The action is inert until a caller supplies
  `onProveMembershipSource`; wiring it through `UserDetailPanel`/`UsersTab` and
  exposing `getMembershipRuleProof` on the `useOktaApi` facade belongs to the
  slice that owns those files. The proof is deliberately not cached — an
  authoritative answer that ages is the failure mode ADR-0020 rejected (b) for —
  so a re-press re-asks.
- **Unverified against a live org.** The endpoint's response envelope is taken
  from the documented shape (a bare array of rule references). The reader also
  unwraps an object carrying the `group-rules` key, and anything else degrades to
  `unknown`, so a wrong guess about the envelope shows as "Okta did not answer"
  rather than as a wrong answer.
