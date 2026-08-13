# ADR-0021: Answer `isMemberOf*` rule clauses from the user's own group list

- Status: Accepted
- Date: 2026-08-13
- Relates to: ADR-0017 (`unevaluable` is never `no-match`), ADR-0020 (attribution
  by provenance), ADR-0006 (untrusted Okta data validated at the boundary),
  `docs/security.md`

## Context

`shared/ruleEvaluator.ts` could not answer the seven Okta EL group-membership
functions — `isMemberOfGroup`, `isMemberOfAnyGroup`, `isMemberOfGroupName`,
`isMemberOfAnyGroupName`, and the `…NameStartsWith` / `…NameContains` /
`…NameRegex` variants. Every one resolved to the `group-membership-fn`
unevaluable reason, because answering them needs the user's full group list and
the module was never given one.

That was correct but expensive. In the two-user comparison it meant a whole class
of rows reported **"Needs investigation"** — the honest answer, but a useless one,
because the panel was _already holding_ both users' complete membership lists. It
had bucketed them into shared/only-compared/only-context two components earlier.

Both `RuleEvaluationOptions` and `ExplainRuleOptions` were written as objects
specifically so this could be added later as "one additive, optional field", and
both said so in their doc comments. This ADR takes that seam.

## Decision

**Add an optional `groups` field carrying the user's complete group list (ids and
names), and implement six of the seven functions against it.**

1. **Absent `groups`, nothing changes.** Every function still resolves to
   `group-membership-fn`. No existing caller changes behaviour by upgrading, and
   surfaces that genuinely lack a group list keep saying so.

2. **With `groups`, the answer is definite in both directions.** Finding no match
   is `false`, not "don't know". This is only sound because the option is
   documented to require the user's _complete_ membership set — the intended
   source is Okta's own `GET /api/v1/users/{id}/groups`, which is authoritative
   and includes directory-sourced groups. A **partial** list would turn every
   unlisted group into a confident `false`, so callers are told to omit the option
   rather than pass a subset.

3. **The grammar gate learns about it too.** `checkRuleNodeSupport` and
   `canEvaluateAst` take `hasGroupContext`, so the "can this be evaluated at all"
   walk and the evaluation walk never disagree.

4. **`isMemberOfGroupNameRegex` is never run**, even with a group list, under its
   own new `group-name-regex` reason code. The pattern is tenant-authored text,
   and there is no way to bound backtracking in a JavaScript `RegExp`; building
   one hands an untrusted rule author a lever that hangs the side panel's only
   thread. Declining to check is the safe answer, and it is reported as a distinct
   fact rather than disguised as "we lack the groups".

5. **Clause explanations carry the groups structurally.** `ClauseExplanation`
   gains `groupReferences`, read straight off the AST rather than re-parsed out of
   `expressionText`, so a group name containing a comma or bracket cannot be
   mis-recovered. This is what lets the comparison say "they would need to be in
   _X_" and offer to grant it, instead of "a clause failed".

Name matching is **case-sensitive**, mirroring Okta: two groups differing only in
case are two different groups.

## Consequences

- The comparison's `needs-group-context` rows become a real remedy,
  `needs-group-membership`, naming every candidate group with a `satisfied` flag —
  which is what makes an `isMemberOfAnyGroup` failure legible ("it wanted any one
  of these, and you have none").
- `RuleExplanationSummary.needsGroupContext` is always `0` once `groups` is
  supplied. It still does not count `group-name-regex` rows, which no group list
  would fix.
- The honesty rule of ADR-0017 is unchanged and now covers a new case: a clause we
  _decline_ to evaluate is still `not-evaluated`, never `fail`.
- Any future caller passing a filtered group list would silently produce confident
  wrong answers. That risk is documented on `RuleGroupContext` itself, at the
  point of use, rather than only here.
