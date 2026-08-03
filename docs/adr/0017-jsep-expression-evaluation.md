# ADR-0017: Parse Okta rule expressions with jsep plus an allow-list evaluator

- Status: Accepted
- Date: 2026-08-03
- Relates to: ADR-0006 (untrusted Okta data is validated at the boundary), the
  "parse untrusted expressions with a real parser" and least-dependency rules in
  `CLAUDE.md`, `docs/security.md` §6

## Context

`shared/ruleEvaluator.ts` had existed for months as a ~300-line hand-written lexer
plus recursive-descent parser for a subset of Okta Expression Language — with a test
file and **zero callers**. Wiring it up mattered because the membership classifier
(`shared/utils/membershipAnalysis.ts`) was calling a member `RULE_BASED` on two
tests only: does an active rule target this group, and is the user off its exclusion
list. It never asked whether the user actually _matched_ the rule, so anyone
hand-added to a rule-fed group was reported as rule-managed.

Reading the evaluator to wire it in surfaced two defects that made it unsafe to act
on:

1. `evaluateRuleExpression` returned `false` both for "evaluated false" and for
   "failed to parse" — the catch swallowed the difference.
2. `canEvaluateClientSide` was a **substring grep** for `isMemberOf` / `app.`. It
   validated no grammar, so an expression using an unsupported operator (`<`, `>`,
   `String.startsWith(...)`) passed the gate, threw inside the parser, and came back
   `false`.

Concluding "no rule matched, therefore this membership is manual" from either of
those would have replaced one wrong answer with a **confidently** wrong one — an
access answer an administrator might act on. Fixing the classifier therefore had to
start with fixing what the evaluator is allowed to claim.

Real Okta group rules also use more syntax than the hand-rolled parser covered
(`==`, `!=`, `&&`, `||`, parens, `user.<attr>`, literals): `<` / `>` / `<=` / `>=`,
negation, and `String.*` calls — `String.startsWith(user.firstName, "andy")` is a
documented Okta example. Extending the hand-rolled parser meant hand-writing
operator precedence, member-access chains and call parsing: the fiddliest,
most security-sensitive code in the repo, against input authored by end users.

Alternatives considered:

- **Keep extending the hand-rolled parser.** Maximum bespoke parser surface, written
  once and reviewed rarely, for syntax that a mature library already handles. The
  "passes the gate, throws internally, returns false" hazard is a _symptom_ of not
  having a real parse step at all.
- **`jse-eval` / `expression-eval`.** Rejected. They evaluate arbitrary JavaScript
  semantics from the AST. That is far more permissive than an allow-list should be
  for untrusted input: the question is not "can we run this expression?" but "is
  this expression one of the handful of shapes we are willing to answer for?"
- **Ask Okta.** There is no evaluate-an-expression API, which is the original reason
  the OEL sandbox was parked (`docs/features-plan.md`).

## Decision

**Adopt [`jsep`](https://github.com/EricSmekens/jsep) for syntax only, and keep our
own evaluator for semantics.** Pinned exactly at `1.4.0` (not a `^` range): MIT, no
runtime dependencies of its own, ~3.5 kB gzipped, AST-only — it evaluates nothing
and generates no code, so it satisfies both the MV3 CSP ban on `eval`/`new Function`
and `CLAUDE.md`'s "parse untrusted expressions with a real parser" rule. Okta's word
operators (`and`, `or`, `eq`, `ne`) are registered as binary operators at module
load; jsep's own token-boundary handling keeps `user.andy` an attribute.

**The evaluator is an allow-list, not a deny-list.** `ruleEvaluator.ts` walks the
AST against explicit sets: `SUPPORTED_BINARY_OPERATORS`, `SUPPORTED_FUNCTIONS` (each
Okta EL function mapped to a pure TypeScript implementation with an exact arity),
and single-level `user.<attribute>` member reads. Anything not on a list —
an unknown function, an unmodelled node type, a computed member access, a wrong
argument count — resolves to _unevaluable_. A function is added to the list only
when its Okta semantics are unambiguous, because an approximation produces a
confidently wrong answer, which is strictly worse than admitting ignorance.
`Arrays.*` collection helpers are not available in group-rule conditions and are
deliberately absent.

**`canEvaluateClientSide` becomes an AST walk** over that same allow-list. This is
the main reason to adopt a parser: the "passes the gate, throws internally, returns
`false`" hazard cannot exist when the gate and the evaluator agree on the grammar.

**The public contract is tri-state.** `tryEvaluateRuleExpression(expression, user)`
returns `'match' | 'no-match' | 'unevaluable'`, and callers that act on the answer
must use it. Internally the walk uses three-valued (Kleene) logic, so an unresolved
operand poisons only the parts of the expression that depend on it —
`unresolvable || true` is still `true`, `unresolvable && false` is still `false`.
That is what lets the function promise it will **never** answer `no-match` when it
merely failed to understand the expression. The legacy boolean
`evaluateRuleExpression` is retained verbatim for its existing behaviour-pinning
tests and documented as unable to make that distinction.

**Hardening, because the input is untrusted tenant data.** Expressions longer than
4096 characters are rejected before parsing (both jsep and the walk recurse; real
group-rule conditions are orders of magnitude shorter). Walk failures are caught and
reported as unevaluable. **Expression text is never logged** — literals can carry
tenant PII — only a reason code (`parse-error`, `too-long`, `unsupported-operator`,
`unknown-fn`, `group-membership-fn`, `fn-arity`, `unsupported-node`, `walk-failed`).

**Group-membership functions stay unevaluable.** `isMemberOfGroup`,
`isMemberOfGroupName`, `isMemberOfAnyGroup*`, `…NameStartsWith`, `…NameContains`,
`…NameRegex` and all `app.*` context need data this module is not given.
`GROUP_MEMBERSHIP_FUNCTIONS` documents the seam for resolving the first group later
by threading the user's full group list in — noting that `isMemberOfGroupName`
matches across _all_ group sources, so name-based resolution needs a multi-source
list, not just cached Okta groups.

## Consequences

- **The evaluator finally has consumers.** `analyzeMemberships` calls it, and
  through it the group-source meter (`shared/membership/groupSource.ts`),
  `useUserMemberships` (UserOverview + user comparison), and `UsersTab`. All three
  get more accurate; none needed rendering changes to keep working.
- **The fix is real but bounded — say so in the UI, not just here.** A membership is
  `attribution: 'exact'` when some non-excluding rule's condition **matches** (it is
  `RULE_BASED`, attributed to that rule) and when **every** non-excluding rule
  evaluates without matching (it is `DIRECT` — this is the manual-add fix), on top of
  the pre-existing exact cases (no active feeding rule; excluded from all of them; an
  `APP_GROUP`). It degrades to `attribution: 'inferred'` in exactly one case: nothing
  matched _and_ at least one feeding rule was unevaluable. Then the legacy heuristic
  still decides, and the answer is labelled rather than trusted. A group whose only
  feeding rule uses `isMemberOf*` therefore reports its rule-managed members as
  indeterminate, by design.
- **`unattributed` is a subset, not a fourth bucket.** `MemberSourceBreakdown`
  holds `direct + ruleBased === total` and `unattributed <= ruleBased`, so a UI
  showing exclusive segments renders `ruleBased - unattributed` as confirmed and
  `unattributed` as **Indeterminate** (`memberSourceBuckets.ts`). Summing the raw
  fields double-counts every indeterminate member.
- **No characterization assertions were flipped** (ADR-0012). The legacy path is
  preserved verbatim for the unevaluable case and merely relabelled, so the tests
  pinning `membershipAnalysis`'s historical behaviour still pass unmodified.
- **A pinned runtime dependency now sits directly on untrusted tenant input** —
  alongside `zod`, which validates it (ADR-0006). Any version bump is a
  security-relevant change and should be reviewed as one. Note where the control
  actually lives: jsep decides only what _parses_; the allow-list decides what we
  are willing to _answer_, so a parser change cannot widen the evaluated surface on
  its own.
- Tests assert all three outcomes explicitly, including that a grammar error yields
  `unevaluable` and never `no-match`.
- **Follow-up (recorded, not scheduled):** closing the `isMemberOf*` seam by
  supplying the user's resolved groups would widen every consumer at once. The
  per-clause "explain this rule against this user" feature in
  `docs/features-plan.md` is the other thing this AST unlocks.
