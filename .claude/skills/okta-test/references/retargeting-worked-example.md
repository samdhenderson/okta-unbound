/**

- Full case-by-case account of the one carve-out (3) retarget this repo has
- actually done, for `SKILL.md`'s "Retargeting, done properly" section. Read this
- before retargeting a suite of your own — it's the difference between "moved
- assertion-by-assertion" and "moved the ones I remembered."
  */

# Worked example: retiring the boolean rule-evaluation APIs

Source of record: `docs/adr/0025-retire-boolean-rule-evaluation-apis.md`, applied in
commit `refactor(rules): remove the boolean rule-evaluation APIs`. Files:
`src/shared/ruleEvaluator.ts`, `src/shared/ruleEvaluator.test.ts`.

## The situation

ADR-0017 had fixed two defects in `shared/ruleEvaluator.ts` — a boolean
`evaluateRuleExpression` that conflated "did not match" with "could not tell," and
a substring-grep `canEvaluateClientSide` gate — by introducing a three-valued
`tryEvaluateRuleExpression` (`'match' | 'no-match' | 'unevaluable'`) plus a real
AST-walking gate, `checkRuleNodeSupport`. It kept the old two functions exported
for their existing callers.

By the time of ADR-0025, `npm run knip:production` showed zero production callers
of either old function. The unit under test — "how do you get a yes/no answer for
whether a user matches a rule" — hadn't disappeared; it had _moved_ onto the
three-valued API. That's carve-out (3), not carve-out (1): the module still has an
answer to the question, just not through the boolean shape.

## The audit, before any deletion

The old `describe('ruleEvaluator')` block in `ruleEvaluator.test.ts` had ten cases,
all built on `evaluateRuleExpression`. Each was checked individually against the
suite it would land in:

| Old case (all via `evaluateRuleExpression`)                                                                    | Disposition                                                               |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Simple equality match (`department == "Engineering"`)                                                          | Already covered verbatim by `tryEvaluateRuleExpression`'s `'match'` suite |
| Simple equality mismatch (`department == "Sales"`)                                                             | Already covered verbatim, `'no-match'` suite                              |
| `eq` operator match                                                                                            | Already covered verbatim                                                  |
| `AND` logic match                                                                                              | Already covered verbatim                                                  |
| `OR` logic — first disjunct true                                                                               | Already covered verbatim                                                  |
| `OR` logic — **second disjunct true** (`department == "Sales" or title == "Developer"`, only the second holds) | **Not** already covered — ported                                          |
| Parenthesised disjunction **conjoined with a further clause**                                                  | **Not** already covered — ported                                          |
| Missing attribute treated as null (`division == null`)                                                         | **Not** already covered — ported                                          |
| Unsupported group function → gate rejects                                                                      | Already covered verbatim by the gate suite                                |
| Invalid syntax → unevaluable                                                                                   | Already covered verbatim                                                  |

Seven of ten were already asserted, word for word, by the three-outcome suite that
already existed alongside the boolean one — the two suites had been drifting into
duplication as `tryEvaluateRuleExpression` grew. The other three were real gaps and
were ported _before_ the old block was deleted, not after — auditing first is what
makes this carve-out (3) rather than a quiet thin-out disguised as one.

## Where the ten cases actually landed

The commit message records the retarget as a table, which is the right level of
detail for a PR note:

```
gate assertions  -> parseRuleExpression + checkRuleNodeSupport (`gateAccepts`)
ungated Kleene   -> evaluateRuleNode (`walkUngated`)
boolean outcomes -> tryEvaluateRuleExpression, asserting match/no-match
parse-memo third entry point -> tryEvaluateRuleExpressionDetailed
```

`gateAccepts` and `walkUngated` are small local helpers defined at the top of
`ruleEvaluator.test.ts` that rebuild the two-step "gate, then walk" pattern the
retired `canEvaluateClientSide` used to wrap in one call — so tests that need to
assert gate behavior in isolation from evaluation still can, without the module
exposing that boolean convenience again.

## Two assertions came out stronger, not just relocated

This is the part worth internalizing: a retarget can _improve_ precision, because
the replacement API has more to say than the original did.

The old suite asserted plain `false` for two different situations:

- `isMemberOfGroup("00gFAKE") && department == "Sales"` — evaluable, and false
  because the department conjunct is false.
- `isMemberOfGroup("00gFAKE") && department == "Engineering"` — **not** evaluable
  client-side at all, because `isMemberOfGroup` requires a group-membership
  lookup the gate can't do locally.

Both produced `false` under the old boolean API — the old test's own name for the
second case, `"stays unresolved (-> false)"`, concedes the API was lying about the
distinction. Retargeted onto `tryEvaluateRuleExpression`, they now assert
`{ resolved: true, value: false }` for the first and `{ resolved: false }` for the
second — exactly the distinction ADR-0017 and ADR-0020 exist to make representable,
now visible in the test rather than papered over by it.

## The correction this forced onto ADR-0022 itself

ADR-0022's own Context section had listed `ruleEvaluator.parity.test.ts` (863 LOC)
as a second retirable suite, on the theory that it pinned only the two boolean
APIs being removed. That was wrong: the parity suite's table 1 pins
`tryEvaluateRuleExpression` — the live, safety-critical API with two production
call sites — not the retired ones. Deleting it would have removed the primary
outcome-parity coverage for the one function whose wrong answer becomes a wrong
access decision.

ADR-0025 records the correction rather than silently editing ADR-0022 (ADRs are
immutable once accepted — see `docs/adr/README.md` and the `check-cited-paths.mjs`
rationale for why). The lesson generalizes: **before deleting a suite because a
sibling ADR or PR description called it retirable, re-derive that claim yourself**
by reading what it actually pins, the same way the ten-case audit above did. A
claim about a test's coverage is not itself coverage.
