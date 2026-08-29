# ADR-0055: What the evaluator refuses to guess

- Status: Proposed
- Date: 2026-08-29
- Scoped by: `I-008`
- Relates to: [ADR-0017](./0017-jsep-expression-evaluation.md) (the parser and
  allow-list this extends), [ADR-0006](./0006-zod-boundary-validation.md) (rule
  expressions are end-user-controllable input),
  [ADR-0021](./0021-group-context-rule-evaluation.md) (the other clause family
  answered without a per-clause call),
  [ADR-0025](./0025-retire-boolean-rule-evaluation-apis.md) (the tri-state result)

> **Numbering note.** `I-008` reserved `0042` on 2026-08-24; that number was
> taken by the audit-log ADR first. See `D-072`.

## Context

`SUPPORTED_FUNCTIONS` in `src/shared/ruleEvaluator.ts` holds seven `String.*`
entries and nothing else. A group rule whose condition calls anything outside
that set evaluates to `UNRESOLVED`, so the admin asking *why is this person in
this group* gets no answer for precisely the rules that are hardest to work out
by hand.

The module states the principle it was built on, and this ADR's job is to extend
coverage without repealing it:

> Deliberately small: a function is listed only when its Okta semantics are
> unambiguous, because an approximation would produce a confidently wrong answer,
> which is strictly worse than reporting the expression as unevaluable.

That is not conservatism for its own sake. `UNRESOLVED` is a **safe** answer: it
propagates through every operator (`ruleEvaluator.ts:527-620`) and surfaces as
"this app cannot tell you", which sends the admin to Okta. A wrong `true` is an
unsafe answer that looks exactly like a right one, and it is the answer an
approximated function gives.

Two scope facts bound the candidate list before any judgement:

1. **Group-rule conditions are not the whole language.** `Arrays.*` helpers are
   unavailable inside a group-rule condition and are already deliberately absent.
   The surface to consider is what Okta actually evaluates in
   `conditions.expression.value`, not the OEL reference in full.
2. **The evaluator only sees a user profile.** It has the user's own attributes
   and group list. Anything requiring session, request, device, or app context
   is not merely ambiguous here — it is unavailable, and no amount of care makes
   it computable.

## Decision

Every candidate is classified into exactly one of three buckets, and the bucket
determines whether it ships.

### Implement — semantics unambiguous, inputs available

- **The current seven, unchanged** — `String.toUpperCase`, `toLowerCase`, `len`,
  `stringContains`, `startsWith`, `endsWith`, `append`. Each is a plain string
  operation with one reading.
- **`String.substringAfter`, `String.substringBefore`** — close siblings of the
  above, total on two string arguments, with the no-match case returning
  `UNRESOLVED` rather than an empty string that would read as a real value.
- **`String.toString(x)`** — total on the scalar types the evaluator models, and
  the single most common cause of an unevaluable numeric comparison.
- **`String.isNullOrEmpty(x)`** — the null-handling is stated by Okta and matches
  the evaluator's existing absent-attribute model.

Each ships with `asString`-style narrowing: an argument of the wrong type
returns `UNRESOLVED` rather than being coerced. Coercion is where a confidently
wrong answer is manufactured.

### Refuse — ambiguous, and the ambiguity is load-bearing

- **`String.substring` with out-of-range indices.** Okta's clamping-versus-
  throwing behaviour at the boundary is not documented, and the disagreement is
  silent: a rule that matches on a truncated string looks identical to one that
  matches on a full one. Implementable **only** once observed against a real
  org, and then only for in-range indices with `UNRESOLVED` outside them.
- **Locale-sensitive case folding.** `toUpperCase`/`toLowerCase` are listed
  above for ASCII; Okta does not state its locale, and Turkish dotless-i alone
  is enough to flip a membership verdict. The implementations stay ASCII-only
  and return `UNRESOLVED` for input outside ASCII rather than guessing a locale.
- **Anything reading request, session, device, or app context.** Not ambiguous
  so much as uncomputable from a user profile. Permanently out of scope, and
  named here so the next reader does not re-litigate it.

### Date and time — a bounded subset, and the timezone is the whole problem

`Instant` and `DateTime` are the largest gap and the most dangerous to
approximate, because every one of their functions is a correct-looking
computation resting on an unstated timezone.

The proposal is deliberately narrow:

- **Implement `Time.now()` and comparisons against ISO-8601 instants** with an
  explicit offset (`Z` or `±HH:MM`). These have one reading.
- **Refuse any date arithmetic on a value with no offset.** A bare
  `2026-08-29T09:00:00` is not a moment in time until a zone is supplied, and
  the zone that matters is the org's, which the evaluator does not have. Return
  `UNRESOLVED`.
- **Refuse relative-window helpers** (`Time.fromWindow`-style, "within N days")
  until the boundary semantics — inclusive or exclusive, evaluated against org
  time or UTC — are observed rather than assumed. A rule granting access "for 30
  days" that the panel reads as 31 is a security statement the panel got wrong.

Arity is checked before evaluation, as it is today (`arity: number`, "calls with
any other count are unevaluable"), and every date function propagates
`UNRESOLVED` through the existing tri-state rather than introducing a fourth
state or throwing.

### The security argument, per addition

ADR-0017 exists because ad-hoc expression evaluation is a known risk, and rule
expressions are end-user-controllable (ADR-0006): an admin who can name a group
can put text in front of this evaluator. Every function above is therefore
constrained the same way, and an addition that cannot meet all four does not
ship:

1. **Pure.** No I/O, no clock read except the single injected `now`, no access to
   anything outside its arguments. The `evaluate` signature already enforces
   this shape.
2. **Total.** Returns `UNRESOLVED` for every input it does not handle. It may
   not throw — a throw inside evaluation escapes into a render path.
3. **Non-amplifying.** No function may allocate or iterate proportionally to an
   attacker-controlled *value*. `String.len` is safe; a repeat or join primitive
   turning a 200-character attribute into a 200MB string is not, and none is
   proposed.
4. **No new parser.** Everything continues to run on jsep's AST under ADR-0017's
   allow-list. No function may take a string and interpret it as an expression.

### Test plan

Per function: the documented happy path; each wrong-arity call; each wrong-type
argument; absent attribute; `null`; empty string. Then, across the set:

- **Hostile inputs** — a 100k-character attribute, deeply nested calls to the
  jsep depth limit, unicode that changes length under case folding, lone
  surrogates.
- **`UNRESOLVED` propagation** — every function, in each operand position of
  every operator, asserting an unresolved argument yields an unresolved result
  and never a `false` that would read as "not a member".
- **Refusal is asserted, not assumed.** Each bucket-two case gets a test pinning
  that it returns `UNRESOLVED` — otherwise "we do not implement this" degrades
  into "someone implemented it later and nothing complained".
- **Mutation-check the tri-state.** Flipping an `UNRESOLVED` return to `false`
  must fail a test. If it does not, the suite is not testing the property this
  ADR is built on.

## Consequences

Rule display gets meaningfully more faithful for the numeric and `toString`
cases, which are common, while the date surface stays honest about a timezone
the app does not know. The refusal list is written down, so the next reader
extends it by argument rather than by accident.

The cost is that `UNRESOLVED` remains common enough that the UI must keep
treating it as a first-class outcome rather than an edge case — this ADR makes
the unevaluable set smaller, never empty.

Two items above are gated on observation rather than argument (`substring`
bounds, relative time windows). Both are questions about a live org and are
added to `D-028`'s audit as items 12 and 13.

## Alternatives considered

**Implement everything OEL documents.** Maximises the answered set and is what
the item warns against — it converts every ambiguity into a confident guess in a
surface whose whole value is being trustworthy about access.

**Send the expression to Okta to evaluate.** Perfectly faithful by construction.
No such endpoint exists for an arbitrary expression against an arbitrary user,
and the per-user cost would be one call per row on a members list this app
attributes in four.
