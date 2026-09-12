# 0003 — `String.stringSwitch`: support it, once verified against Okta's own docs

Status: Accepted — 2026-09-11

Supersedes the `String.stringSwitch` bullet of [0001](0001-rule-assessment-certainty.md) §3.
Every other refusal in that section stands, and its governing principle — a
function is implemented only where Okta's semantics are exactly pinnable,
because a guess produces a confidently wrong answer that is strictly worse
than the `unevaluable` it would replace — is not weakened here; it is the test
this record applies to a function 0001 had not actually checked against
Okta's published reference.

## Context

0001 refused `stringSwitch` on the belief that "its no-match behaviour is not
pinned by the documentation." Checking Okta's Expression Language reference
directly (`developer.okta.com/docs/reference/okta-expression-language`)
disproves that belief: the documented signature is

```
String.stringSwitch(String input, String defaultString, String... keyValuePairs) -> String
```

`defaultString` is a **required** positional argument, not an optional third
slot — there is no documented form of the call that omits it. Okta's own
worked examples pin every remaining question a "guess" would otherwise have to
answer:

- Matching is **substring containment**, not equality —
  `stringSwitch("Substrings count", "default", "ring", "value1")` returns
  `"value1"` because `"Substrings"` contains `"ring"`, not because it equals it.
- Pairs are tried **in the order supplied**, and the first one whose key is
  contained in the input wins, even when a later key also matches —
  `stringSwitch("First match wins", "default", "absent", "value1", "wins",
"value2", "match", "value3")` returns `"value2"`, skipping over `"match"`
  (also present in the input) because `"wins"` was listed first.
- No pair matching returns `defaultString` — always, because it is a required
  argument, not a branch the function can be called without.

So the fork 0001 posed — "the no-match branch is exactly the one a rule turns
on, and we do not know what it does" — does not describe this function once
its own documentation is read. Every branch has a stated answer.

## Decision

Implement `String.stringSwitch` in full: a matched pair resolves to its
value, and no pair matching resolves to `defaultString`. Both are ordinary
resolved values, not an `unevaluable` outcome — there is no unpinned
fall-through left to withhold on. Arity is variadic-with-pairs: at least two
arguments (`input`, `defaultString`), and every argument after those two must
come in complete `(key, value)` pairs — an odd trailing count, or fewer than
two arguments, is `fn-arity`. Argument type is checked with the same
`asString` discipline every other `String.*` function uses; a non-string
operand is `operand-type`, never coerced.

`SUPPORTED_FUNCTIONS`'s per-entry `arity` grows from a bare number to `number
| VariadicPairsArity`, checked by one shared `arityMatches` helper used by
both the grammar gate (`isSupportedNode`) and the evaluation walk
(`evaluateCall`) — the two must keep agreeing on what a call's shape allows,
the same discipline `GROUP_MEMBERSHIP_IMPLEMENTATIONS`'s `variadic` flag
already uses for the `isMemberOfAnyGroup*` family.

No new `RuleUnevaluableReason` code is introduced. 0001's plan for this
function anticipated a form of the call with no default, which would have
stayed genuinely unpinned and needed its own reason code; Okta's documented
signature does not have that form, so there is nothing to name.

## Consequences

- Rules built on `stringSwitch` — a common shape for mapping a departmental or
  regional code onto a small set of values inside a condition — move from
  permanently `unevaluable` to a real `match`/`no-match`, which is the
  membership-attribution ladder's rung 2 (RULE_BASED, `exact`) instead of a
  fallback rung. Pinned by a `membershipAnalysis` test.
- `String.replaceFirst` and the `Time.*`/`Convert.*`/`Instant`/`DateTime`
  refusals in 0001 §3 are unaffected: none of their arguments are checked
  against source, and none is reopened by this record.
- If a future Okta release changes `stringSwitch`'s documented signature (an
  optional default, say), this record's arity assumption breaks by
  construction — `arityMatches`'s `VariadicPairsArity.minArgs` would need to
  drop to admit a defaultless call, and that call's fall-through would need a
  real reason code again, because at that point the no-match branch would
  once more be a guess.
