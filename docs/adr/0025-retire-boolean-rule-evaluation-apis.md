# ADR-0025: Retire the boolean rule-evaluation APIs

- Status: Accepted
- Date: 2026-08-13
- Amends: [ADR-0017](./0017-jsep-expression-evaluation.md)
- Relates to: [ADR-0020](./0020-attribution-provenance-not-a-fourth-level.md),
  [ADR-0021](./0021-group-context-rule-evaluation.md),
  [ADR-0022](./0022-test-lifecycle.md)

## Context

ADR-0017 opens by naming two defects in `shared/ruleEvaluator.ts` that made it unsafe
to act on the evaluator's answers:

1. `evaluateRuleExpression` returned `false` both for "evaluated false" and for
   "failed to parse" — the catch swallowed the difference.
2. `canEvaluateClientSide` was a substring grep for `isMemberOf` / `app.`, so an
   expression using an unsupported operator passed the gate and came back `false`.

ADR-0017 repaired both — the gate became a real AST walk, and the three-valued
`tryEvaluateRuleExpression` was introduced so "did not match" and "could not tell"
stop being the same answer. It then **kept both original functions exported**, for
existing callers and their tests.

The callers are gone. `npm run knip:production` reports zero production references to
either function, or to `tryEvaluateRuleExpressionDetailed`. Everything that acts on a
rule outcome — `membershipAnalysis`, `shared/rules/explainExpression` — goes through
the three-valued API or the AST seam.

What remains is not neutral. `evaluateRuleExpression` is the shape ADR-0017 was
written to get away from, still exported, still the most inviting signature in the
module. The next author who needs "does this user match this rule?" greps, finds a
function returning a clean `boolean`, and reintroduces the exact defect: a `false`
that means "could not tell" being read as "no match", which
[ADR-0020](./0020-attribution-provenance-not-a-fourth-level.md) turns into a member
reported as a **manual add** on an access screen. Deleting it is cheaper than
documenting around it forever.

`canEvaluateClientSide` is redundant rather than dangerous. Its docstring instructs
callers to run it _before_ `evaluateRuleExpression` — a two-step pattern that only
existed to prop up the lossy API, since `tryEvaluateRuleExpression` applies the same
gate itself. `checkRuleNodeSupport` runs the identical allow-list walk and returns a
**reason code** instead of a bare boolean.

## Decision

**Remove `evaluateRuleExpression` and `canEvaluateClientSide`**, along with the
now-unreachable private `evaluate()` helper. The module keeps no boolean entry point:
a two-valued API cannot express the distinction the three-valued core exists to make.

**Keep `tryEvaluateRuleExpressionDetailed`.** `knip:production` flags it as unused,
but it is knip's documented judgment case — a public API with no current caller, not
dead weight. It is a four-line wrapper, it is the reason-carrying twin of the
recommended API, and it is the safe shape rather than the hazardous one. Deleting it
would push the next caller into hand-rolling `parseRuleExpression` +
`evaluateParsedRule`, which is worse code, not less of it. Recorded in
[dead-code.md](../dead-code.md) as an accepted advisory finding.

**Correct ADR-0022's Context.** ADR-0022 lists `ruleEvaluator.parity.test.ts` (863
LOC) as a superseded pin whose two APIs "only it calls", implying it could be retired
wholesale. That is wrong on the facts. The suite has two tables: table 2 pins the
gate, but **table 1 pins `tryEvaluateRuleExpression`** — the live API two production
call sites depend on — plus meta-assertions that every `SUPPORTED_FUNCTIONS` and
`GROUP_MEMBERSHIP_FUNCTIONS` entry has both a match and a no-match row. Deleting it
would have removed the primary coverage of the module's most safety-critical
function. The suite stays; table 2 is retargeted onto the gate's live surface.

## Test disposition (ADR-0022)

Every assertion was retargeted, not dropped. Route by route:

| Retired surface                           | Retargeted onto                                                                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate, whole expression                    | `parseRuleExpression` + `checkRuleNodeSupport` — byte-identical walk over the same memoised parse, wrapped as a local `gateAccepts` helper in both suites |
| Ungated three-valued walk                 | `evaluateRuleNode` — the same walk minus the grammar gate, as a local `walkUngated` helper                                                                |
| Boolean outcome on allow-listed input     | `tryEvaluateRuleExpression`, asserting `match` / `no-match` explicitly                                                                                    |
| Third entry point in the parse-memo tests | `tryEvaluateRuleExpressionDetailed`                                                                                                                       |

The `describe('ruleEvaluator')` block that drove the boolean API was deleted after
auditing all ten of its cases against the three-outcome suite. Seven asserted
expressions already covered there verbatim. **Three were uniquely covered and were
ported** before deletion, as ADR-0022(3) requires:

- a satisfied second disjunct of an `or` word-form
- a parenthesised disjunction conjoined with a further clause
- an absent attribute compared against `null` (reads as null → `match`, distinct from
  the existing absent-attribute `no-match` row)

Two retargets are **strictly stronger** than what they replaced, because the boolean
form could not express the distinction:

- `isMemberOfGroup(…) && user.department == "Sales"` now asserts
  `{resolved: true, value: false}` — genuinely false — while
  `isMemberOfGroup(…) && user.department == "Engineering"` asserts `{resolved: false}`.
  The old suite asserted `false` for both and its own test name conceded the gap
  ("stays unresolved (→ false)").
- Every `false` in the retired block became either `no-match` or `unevaluable`
  explicitly. That is the distinction the whole module exists to preserve, and it is
  now pinned at each of those call sites.

Net: `ruleEvaluator.test.ts` 90 tests, `ruleEvaluator.parity.test.ts` 166,
`ruleEvaluator.groupContext.test.ts` unchanged — 279 passing.

## Consequences

- The evaluator has one outcome vocabulary. There is no signature in the module that
  can report "could not tell" as "no".
- Three exports leave the public surface; `evaluate()` goes with them. Small in LOC
  (~60), and that is not the point — the hazard is what was removed.
- ADR-0017's two named defects are now closed rather than repaired-and-retained. Its
  Context remains the best account of why the three-valued core exists.
- `tryEvaluateRuleExpressionDetailed` stays as a standing `knip:production` finding.
  It must not be "cleaned up" by a later sweep without revisiting this ADR.
- The parity suite is now correctly described as guarding the live API rather than a
  landed refactor. Its header says so.
- Anything reintroducing a boolean rule-evaluation helper needs an ADR superseding
  this one.
