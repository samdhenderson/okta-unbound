# 0001 — Rule assessment: the certainty ladder, and what the evaluator refuses

Status: Accepted — 2026-09-09

## Context

An admin asking "why is this person in this group" was getting three kinds of
wrong answer, and each had a different cause.

**The panel withheld an answer it was already holding.**
`membershipAnalysis.classify()` evaluated every rule condition with no group
context, while its own caller held the user's complete, `Link`-paginated
membership list. So every `isMemberOf*` rule came back `unevaluable`,
attribution fell through to a substring scorer, and the row header read
"probably this rule" — directly above a disclosure that, fed the same list one
component away, answered the identical clause correctly. One surface, two
answers, and the more confident of the two was the wrong one.

**The evaluator was confidently wrong rather than silent.**
`user.status == "ACTIVE"` — an ordinary Okta rule — resolved `user.*` against
the profile only, found nothing, read the absence as `null`, and returned
`no-match` for every user in the org. Non-scalar profile values were
`String()`-coerced, so a multi-valued attribute became `"a,b"` and fed a
confident equality verdict. Rule-level group exclusions were typed and read by
nobody.

**Where it could not answer, it could not say what it was asking about.**
Five surfaces printed rule condition text and each built its own id→name map out
of whatever it happened to hold, so a group id in a condition rendered raw
exactly when it mattered most: the prerequisite group the reader is _missing_ is
by definition not in the list the surface was naming from.

`docs/claims.md` already forbids all of this — _uncertainty is a defect, not a
disclosure_ — but it did not say what "go and find out" costs, or where the
limit is. That is the fork this record settles: an answer the panel does not
have is worth API calls, and there has to be a written stopping point or the
rule becomes "fetch everything".

## Decision

### 1. Four rungs, cheapest first, and no rung may be skipped

An attribution claim is produced by the first rung that can answer:

1. **Okta's own embed.** `_embedded['group-rules']` on the group roster, where
   the roster carried it. Free, authoritative, already in hand.
2. **The evaluator, with the user's complete group list.** No API traffic. This
   is where nearly every answer is expected to come from, and a miss here is a
   defect to fix here.
3. **The org rules listing.** One paginated `GET /api/v1/groups/rules`, shared
   org-wide through the entity cache, so the org pays for it once and every
   later user's load is free.
4. **`GET /groups/{gid}/users/{uid}/group-rules`, fired automatically**, for the
   memberships that survived rungs 1–3 unsettled. One call per unsettled row,
   once per row, only while the surface is on screen and the list has settled.

Rung 4 is the only rung that scales with the number of rows, and it is the one
that must stay rare. **If it fires often, that is a defect in rung 2**, to be
fixed in rung 2 — not a cost to absorb and not a reason to remove the rung. It
was previously behind a per-row click, which reads as prudence and is really
just leaving the reader hedged until they happen to open the right row.

### 2. The group list is passed in, never derived

`RuleGroupContext` is an explicit argument and is **never** inferred from
whatever collection a caller happens to be iterating. `isMemberOf*` is
two-valued over the list it is given: a group absent from that list is not
"unknown", it is a confident "they are not in it". Two live callers
(`groupSource`, `memberSourceIndex`) hold a _one-group_ list; deriving context
from their argument would turn every other group the member belongs to into a
confident negative. They pass nothing and degrade honestly, which is correct.

The mapping to that shape has exactly one implementation
(`shared/membership/groupContext.ts`) so two surfaces cannot answer
`isMemberOfGroup` differently about the same person.

### 3. Which expression functions we implement, and why the rest are refused

Coverage grows only where Okta's semantics are **exactly pinnable**. A function
whose behaviour we would have to guess at is not a gap to be filled — a guess
produces a confident wrong answer, which is strictly worse than the
`unevaluable` it replaces.

Implemented: the `String.*` predicates and transforms whose contract is
unambiguous (`join`, `removeSpaces`, `replace`, `substring`, `substringAfter`,
`substringBefore`, and the existing set), plus `Arrays.contains`, `Arrays.size`,
`Arrays.isEmpty`, `Arrays.toCsvString` — Okta documents rule conditions as
accepting String, Arrays and user expressions, and the array functions are what
make a multi-valued profile attribute answerable at all.

Refused, each for a stated reason:

- **`Time.*` and `Convert.*`** — Okta rejects both inside a group-rule
  condition. Implementing them would be implementing a form the platform will
  not accept.
- **`Instant` / `DateTime`** — the org's timezone is not readable from where we
  evaluate, so any answer is a guess with a timezone attached.
- **`String.stringSwitch`** — its no-match behaviour is not pinned by the
  documentation, and that is precisely the branch a rule turns on.
- **`String.replaceFirst`** — its target is a regular expression in Java. We
  would either implement it wrongly as a literal, or compile tenant-authored
  patterns, which is the next item.
- **`Arrays.add` / `Arrays.flatten`** — they return collections, and a collection
  is not an operand any comparison here accepts.
- **`isMemberOfGroupNameRegex`** — a standing refusal, not an omission. The
  pattern is tenant-authored and there is no way to bound backtracking in a JS
  `RegExp`, so evaluating one is handing an expression author a denial-of-service
  lever inside the admin's own browser. The reason sentence says the check was
  not performed; it never says the user failed it.

Everything is parsed to an AST with `jsep` and walked. No `eval`, no
`new Function`, no `RegExp` built from tenant text — the manifest CSP forbids
the first two and this record forbids the third.

### 4. Absent, null, and false are three different facts

> **Superseded by [0004](0004-absent-attribute-is-null.md).** The principle below
> stands; its premise about Okta's wire format does not. Okta reports a null attribute
> by omitting it from the profile object, so an absent profile attribute **is** `null`
> and resolves rather than declining. The half that was load-bearing — a top-level user
> field resolving from the user root, never off the profile — is kept and sharpened
> there under a new reason code. Read 0004 before acting on this section.

- An attribute **present and explicitly `null`** resolves to `null`.
- An attribute **absent from the profile** is `unevaluable`, reason
  `attribute-absent`. Absent is not null, and null is not `no-match`.
- A **top-level Okta user field** (`id`, `status`, `created`, `activated`,
  `statusChanged`, `lastLogin`, `lastUpdated`, `passwordChanged`) resolves from
  the user root through an explicit allow-list, because `user.status` is real
  Okta EL and reading it off the profile is how the whole org came back
  `no-match`.
- A **non-scalar** value is `unevaluable` (`operand-type`), never stringified.

This is `docs/claims.md`'s order of preference applied in order: make it certain
first, and withhold only what genuinely cannot be made certain.

### 5. One resolver names group ids, and its fetch is bounded by the screen

`useGroupNameResolver` is the only id→name path. Caller-held names, then the org
snapshot, then `GET /api/v1/groups/{id}` for ids a surface is **about to
print** — never a walk over the rule corpus, which would be hundreds of calls to
label rules nobody is reading. Ids are shape-checked before entering a request
path, because they arrive from tenant-authored expression text.

## Consequences

- Surfaces that showed a confident `no-match` will show `unevaluable` where the
  attribute was never there, and `Direct` where a credited rule excluded the
  user. Answers move on live data; that is the fix, not a regression.
- A user's memberships pane can now issue rung-3 and rung-4 requests where it
  previously issued none. The ceiling is one shared rules listing per org plus
  one call per unsettled row, and the second term is expected to be near zero.
- The refusal list is a maintenance obligation: when Okta documents
  `stringSwitch`'s no-match behaviour, or exposes the org timezone, the argument
  above stops applying and the function can be added. The list says _why_, so a
  future reader can tell a settled refusal from a stale one.
- `isMemberOfGroupNameRegex` stays unevaluable indefinitely. This is the one
  place the panel accepts a permanent gap, and it accepts it on security
  grounds.

## The rules, stated where they are looked up

`docs/claims.md` — the ladder, the three-way absent/null/false distinction, the
new `attribute-absent` reason code, and the never-guess principle for expression
coverage.
