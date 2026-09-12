# 0002 — Evaluate tenant regexes with a linear-time matcher

Status: Accepted — 2026-09-11

Supersedes the `isMemberOfGroupNameRegex` bullet of [0001](0001-rule-assessment-certainty.md) §3.
Every other refusal in that section stands, and its ban — **no `RegExp` built
from tenant text** — is not weakened by this record; it is the constraint the
design below exists to satisfy.

## Context

`isMemberOfGroupNameRegex` was a standing refusal: the pattern is
tenant-authored, and a JS `RegExp` has no way to bound backtracking, so
evaluating one hands an expression author a denial-of-service lever inside the
admin's own browser. The cost of the refusal grew as the breakdown display
matured: a rule built on a name regex — a common shape in orgs with structured
group names (`^SecOps-.*`) — renders "Not evaluated" forever, and membership
attribution for every group such a rule feeds falls through to rung 3/4 of the
certainty ladder. The single biggest population of honest-but-unhelpful answers
traced to this one function.

The fork: keep the refusal (safe, permanently blind), or evaluate the pattern
without ever constructing a backtracking matcher from it.

## Decision

Evaluate tenant patterns with a hand-written **linear-time engine**
(`src/shared/rules/safeRegex.ts`): pattern parser → Thompson NFA →
breadth-wise simultaneous-state simulation. No backtracking exists in the
implementation, so no input can trigger it. `new RegExp` is never called on a
tenant pattern — the 0001 ban survives verbatim. (The test suite may use
`RegExp` as an oracle on our own fixture patterns; fixtures are not tenant
text.)

Guard rails, all hard caps exported as constants and enforced before/during
simulation:

- pattern length, input length, NFA state count, and a total step budget;
- a supported syntax subset (literals, escapes, `.`, character classes and
  ranges, negated classes, `*` `+` `?`, alternation, grouping, anchors) —
  backreferences, lookaround, bounded repetition `{n,m}`, inline flags, and
  unknown escapes are **declined, never approximated**;
- full-match (`Java matches()`) semantics, matching Okta's server-side
  behaviour for this function.

Every failure mode is a structured decline, not a guess: the module returns
its own code per guard (`unsupported-syntax`, `parse-error`, `pattern-too-long`,
`input-too-long`, `too-many-states`, `step-budget-exceeded`, `internal-error`),
and the rule evaluator collapses them into two `RuleUnevaluableReason` codes —
`regex-unsupported-syntax` for the first two, `regex-too-complex` for the
rest — that surface as `unevaluable` — the 0001 principle that a guess is strictly worse than an
`unevaluable` is unchanged; the set of questions we can answer grew, the
epistemics did not move.

Consequence for attribution, named deliberately: rules that were `unevaluable`
can now resolve to `match`/`no-match`, which flips membership attribution from
the fallback rungs to rung 2 (RULE_BASED). That is the point of the change, and
it is pinned by a `membershipAnalysis` test.

## Consequences

- The `group-name-regex` reason code retires from the emit path (kept in the
  union until the flat-explanation cleanup lands, then deleted). Its refusal
  sentence disappears rather than being softened.
- Patterns outside the subset stay honestly unevaluated; the subset can widen
  in later records if real tenant patterns demand it, construct by construct,
  never by falling back to `RegExp`.
- `safeRegex.ts` is a security surface: changes to it get
  `security-logging-reviewer` review, and its adversarial test corpus (nested
  quantifiers, alternation blowups at the caps) is part of the contract, not
  optional coverage.
