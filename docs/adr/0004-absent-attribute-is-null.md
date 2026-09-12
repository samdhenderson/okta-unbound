# 0004 — An absent profile attribute is `null`, because that is what Okta means by absent

Status: Accepted — 2026-09-12

Supersedes [0001](0001-rule-assessment-certainty.md) §4's rule that "absent is not
null". Everything else in 0001 stands: three-valued evaluation, the refusal to round
`unevaluable` to `no-match`, and the never-guess principle governing §3. This record
narrows exactly one claim — 0001's belief about what an absent key in Okta's wire
format _means_ — and leaves the machinery that claim was protecting intact.

## Context

0001 §4 held that a `user.<attribute>` naming a key the profile does not carry is
`unevaluable`, reason `attribute-absent`, on the principle that "absent is not null,
and null is not `no-match`". The principle is sound. The premise underneath it is
not, and it is the premise this record corrects.

**Okta does not distinguish the two on the wire.** Okta's own support documentation
states it directly:

> **Blank (" ")**: The attribute is present in the profile object with an empty string
> value (for example, `"customAttribute": ""`).
> **Null**: The attribute is not present in the profile object.
>
> — [Blank versus null attribute values in expressions][blank-vs-null]

So an absent key is not a gap in our knowledge of the user. It **is** the null value,
reported the only way Okta reports it. Treating absence as "we could not read this"
described a state Okta has no way of expressing.

**And Okta pins what null does in a comparison**, by naming its parent language:

> Okta Expression Language is based on SpEL and uses a subset of the functionalities
> offered by SpEL.
>
> — [Okta Expression Language overview][okta-el]

In SpEL, `null == 'Sales'` is `false` and `null != 'Sales'` is `true`. Equality is
null-safe; it does not throw and it does not decline.

The cost of the old reading was not theoretical. The blast radius report evaluates
every rule in the org against one user, and an org whose rules read attributes any
given user does not carry produced **~200 rows under "Could not be evaluated"** — a
list of rules an admin has no reason to care about, crowding out the handful their
edit actually moves. The same absence fed the `Unresolved` pill on the user's Groups
pane, the `cannot-determine` group in the comparison worklist, and the `Indeterminate`
bucket in the group member-source meter.

## Decision

### 1. An absent profile attribute resolves to `null`

`resolveMember` returns `null` where it returned `giveUp('attribute-absent')`. The
comparison semantics it flows into are already the pinned ones — the evaluator has
always compared a _present-and-`null`_ value correctly — so this introduces **no new
guess**. It routes a value Okta already defined into machinery that already handled it.

`asOperand(undefined)` resolves to `null` for the same reason. A draft that clears an
attribute means the user will hold no value for it, which is exactly `null`; the
`draftedUser` comment in `shared/membership/blastRadius.ts` already claimed this and
the code did not deliver it.

### 2. A missing **top-level** field is still `unevaluable`, under its own reason code

This is the half of 0001 §4 that was load-bearing, and it is kept and sharpened.

A top-level Okta user field (`status`, `created`, `lastLogin`, …) is real Okta EL and
is not on the profile. Reading `user.status` off the profile is how an entire org came
back `no-match` (D-114). `USER_TOP_LEVEL_FIELDS` resolves those from the user root and
stays **ahead** of the new null resolution, so that regression cannot return.

When such a field is on the allow-list but missing from the response, that absence is
a fact about **our request**, not about the org — so it keeps declining, under a new
reason code `field-not-fetched`. Two different absences must never share one code:

| The attribute is…                             | The answer is                       |
| --------------------------------------------- | ----------------------------------- |
| Present, holding a value                      | That value                          |
| Present and explicitly `null`                 | `null`                              |
| **Absent from the profile**                   | **`null` — the org holds no value** |
| Present holding `""`                          | `""` — a value, not "no value"      |
| A known top-level field missing from the wire | `unevaluable`, `field-not-fetched`  |
| A top-level field we never carry              | `unevaluable`, `field-not-fetched`  |
| Present but not a scalar                      | `unevaluable`, `operand-type`       |

The last row is the one this record nearly got wrong. A name that is a real Okta user
field but outside the addressable set — `credentials`, stripped at the zod boundary
because it carries credential material, and `type`/`_links`, which the boundary does
not carry — is neither on the profile nor resolvable from the user root. Left to fall
through it would now resolve to `null`, asserting the org holds no value when in truth
we simply cannot see the field. `USER_FIELDS_NOT_FETCHED` enumerates them so they
decline: the D-114 mistake in a new place, caught by the parity table's
`user.credentials == null` row rather than by an admin.

`attribute-absent` is retired from the union, and so is the explainer's
`ATTRIBUTE_ABSENT` sentinel. That symbol existed to hold absence apart from `null` in a
clause's recorded reads, and this record is the finding that there is nothing to hold
apart: Okta cannot express the difference, so one fact gets one value. The Clause Ledger
still renders it **`not set`** rather than the word `null` — "not set" is the half of
that pair that tells an admin something — but it now describes a clause that reached a
verdict rather than one that was declined. A blank `""` stays visibly distinct from
both, because that _is_ a different fact.

This split only holds while "absent" reliably means "the org holds no value". It was
audited before this record was written: `oktaProfileSchema` is `.passthrough()` so
org-custom attributes survive validation (test-proven, not assumed), `draftedUser` is a
superset of the original profile, and no fetch, cache, or narrowing step on any
evaluation path drops a profile key. **If a projected profile ever reaches the
evaluator, this decision becomes unsafe** and the guard above is what will be wrong.

### 3. A `null` argument makes a string **predicate** false — and this one is an inference

`String.stringContains`, `String.startsWith`, and `String.endsWith` answer `false` when
their subject is `null`. A user who holds no value cannot satisfy a containment or
prefix test.

**State the footing honestly: this is weaker than §1 and §2.** Okta documents neither
its String functions' null behaviour nor an exception to it, so this rests on an
argument — no value cannot satisfy a positive string test — and not on a published
contract. It is recorded here rather than buried in the code precisely so a future
reader can re-check it against a live org instead of re-deriving the reasoning. If it
is ever disproved, §1 and §2 stand without it.

**Value-returning functions keep declining on `null`** — `String.len`,
`String.toUpperCase`, `String.toLowerCase`, `String.substring`, `String.append`,
`String.join`, `String.replace`, `String.removeSpaces`, `String.substringAfter`,
`String.substringBefore`, `String.stringSwitch`. Answering those would mean _inventing a
value_ (`String.len(null)` → `0`?), which is the guess 0001 §3 exists to stop. The
predicate/value split is the line: a predicate asks a question `null` can answer, a
value-returner asks for data `null` does not have.

## Consequences

**Rules that previously said nothing now say something, in both directions.** Under §3,
`NOT String.stringContains(user.dept, "x")` becomes `true` for a user with no `dept` —
the same direction SpEL gives `!=` on null, and the honest consequence of answering at
all. Some rules will now report `starts-matching` where they reported `undetermined`.
That is the point; it is also the risk, and it is pinned by test rather than left to
be discovered.

**Relational operators are untouched.** `user.x > "A"` still declines — SpEL throws when
ordering null, and this evaluator requires two numbers anyway. That second restriction
is its own gap (Okta's recommended blank-check idiom is `user.x > " "`, and Okta
documents that a blank string sorts below any populated one), tracked separately; it is
not null semantics and is not decided here.

**Withholding is still the default.** Nothing here weakens 0001's core: the evaluator
answers only where Okta's behaviour is pinned, `unevaluable` is never rounded to
`no-match`, and the reason codes stay structural so no gate reads a sentence.

## Note on 0001's other stale text

0001 §3 still lists `String.stringSwitch` and `isMemberOfGroupNameRegex` as permanent
refusals. Both were reversed — by [0003](0003-stringswitch-matched-cases.md) and
[0002](0002-linear-time-tenant-regex.md) respectively — and both are implemented today.
Flagged here so a reader arriving at 0001 through this record is not misled by it; the
corrections belong to those records, not this one.

[blank-vs-null]: https://support.okta.com/help/s/article/blank-and-null-attributes-values?language=en_US
[okta-el]: https://developer.okta.com/docs/reference/okta-expression-language/
