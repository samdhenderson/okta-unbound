# Claims

What the panel is allowed to tell an admin, and how it says it.

This is the product's differentiator, not a style preference. Anyone can list
groups. The panel is worth using because an answer it gives can be taken to a
change board. Every rule here exists to keep that true.

Read this when you are about to put a fact on screen that the app worked out
rather than read directly off an Okta response.

## The rule

**Assert or withhold. Never hedge.**

An answer is either backed by evidence — in which case state it plainly, with no
qualifier — or it is not, in which case say that it is not, and why. There is no
third register. The panel does not say "probably", "likely", "approximately", or
append a `?` to a label it is unsure of.

Hedging fails both readers. An admin who trusts the hedge is being handed a
judgement call the app was better placed to make. An admin who ignores it is
reading an assertion the app did not intend. Neither one is served by the word.

### Uncertainty is a defect, not a disclosure

This is the rule the others follow from, and it governs what you build, not just
what you write.

**If a feature cannot state its answer with certainty, the feature is not
finished.** Wanting to write "likely" is not a copy problem to be solved with a
better sentence — it is the feature telling you it does not yet know something it
needs to know. The work is to go and find out: fetch the field that was missing,
call the endpoint that settles it, narrow the question until it is answerable.

The disclaimer is the easy exit, and it is closed. It converts the app's unsolved
problem into the admin's interpretation problem, and it does so silently — a
shipped hedge looks like diligence, so nothing ever gets fixed. Every hedge in
this codebase's history outlived the difficulty that produced it.

So when the certain answer is not available yet, the order of preference is:

1. **Make it certain.** Fetch, compute, or verify whatever is missing. This is
   the default and it is usually possible.
2. **Narrow the question** until what remains is certain, and answer that. A true
   smaller claim beats a hedged larger one — `Checked 3 of 12 apps` is worth more
   than `12 apps (approximate)`.
3. **Withhold**, naming the absence and its reason, and file the gap as work.

There is no fourth option. Shipping the claim with a qualifier attached is not on
the list, and neither is shipping it bare and hoping.

A hedge that survives review is a bug that was documented instead of fixed.

The three shapes this takes:

| Situation                      | What ships                                                     |
| ------------------------------ | -------------------------------------------------------------- |
| Evidence supports the claim    | The claim, stated flat: `Added`, `Rule`, `12 members`          |
| Evidence is missing or deduced | A named absence: `Not predicted`, `Unresolved`, and the reason |
| The fact was never loaded      | Nothing at all — see **Absent is not zero**                    |

### Going and finding out has a written cost

"Make it certain" would be an unbounded instruction without a stopping point, so
rule assessment states its own. An attribution claim comes from the first rung
that can answer, and no rung may be skipped:

1. **Okta's own embed** — `_embedded['group-rules']` where the roster carried it.
   Free.
2. **The evaluator, given the user's complete group list.** No API traffic, and
   where nearly every answer should come from. A miss here is a defect _here_.
3. **The org rules listing** — one paginated `GET /api/v1/groups/rules`, shared
   org-wide through the entity cache, so the org pays once.
4. **`GET /groups/{gid}/users/{uid}/group-rules`, automatically**, for what
   survives rungs 1–3 unsettled. One call per unsettled row, once per row, only
   while the surface is on screen.

Rung 4 is the only one that scales with the row count. **If it fires often, fix
rung 2** — the cost is a symptom, never a budget to spend. The reasoning behind
each rung, and the API budget it commits to, is
[ADR-0001](adr/0001-rule-assessment-certainty.md).

### Absent, null, and false are three facts, not one

The evaluator keeps them apart, and so must anything reading it:

| The attribute is…             | The answer is                     |
| ----------------------------- | --------------------------------- |
| Present, holding a value      | That value                        |
| Present and explicitly `null` | `null`                            |
| Absent from the profile       | `unevaluable`, `attribute-absent` |
| Present but not a scalar      | `unevaluable`, `operand-type`     |

Reading an absent attribute as `null` is how `user.status == "ACTIVE"` came to
return `no-match` for every user in an org where it matches nearly everyone. A
top-level Okta user field (`status`, `created`, `lastLogin`, …) resolves from the
user root through an explicit allow-list, because it is real Okta EL and is not
on the profile.

### Never guess a function's semantics

Expression coverage grows only where Okta's behaviour is exactly pinnable. A
function whose contract we would have to infer is not a gap to fill: a guess
produces a confident wrong answer, which is strictly worse than the
`unevaluable` it replaces. `shared/ruleEvaluator.ts`'s allow-list carries the
reason for each refusal beside it, so a settled refusal stays distinguishable
from a stale one.

`isMemberOfGroupNameRegex` is refused permanently and on security grounds: the
pattern is tenant-authored, JS `RegExp` backtracking cannot be bounded, and
evaluating one hands an expression author a denial-of-service lever inside the
admin's own browser. The reason sentence says the check was not performed. It
never says the user failed it.

## Evidence is structural, never lexical

**A decision about correctness never reads a string meant for a human.**

This is the rule that keeps the one above safe. If the code branches on whether a
label says `Rule` or `Rule?`, then the epistemics live in the copy — and the day
someone edits the copy, the correctness changes silently and no test notices.
That is not hypothetical; it is how `removalEffect` came to assert removals it was
built to withhold.

So evidence is carried in the type, next to the answer it qualifies:

- `membershipVerdict()` returns a `deduced: boolean` alongside `label` and
  `variant`. `isMembershipAttributionDeduced()` is the predicate callers gate on.
- `GroupEffect` carries `kind` plus, when withheld, a `WithheldReason` code.
- `RuleMatchOutcome` is a three-valued union, not a boolean with a caveat.

Copy is then free to be plain, because nothing depends on its wording. Rename a
badge whenever the wording improves; no gate moves.

Corollary: **a reason code is never a sentence.** `blastRadius.ts` ships codes
only — the prose lives in `shared/rules/unevaluableReasonText` and the components.
Every string that module touches (rule names, conditions, group names, drafted
values) is end-user-controllable tenant data, which is also why it imports no
logger and must never gain one.

## The vocabularies

Four unions carry every claim the panel makes. Extend these rather than inventing
a parallel scheme.

**Rule evaluation is three-valued.** `RuleMatchOutcome` is
`'match' | 'no-match' | 'unevaluable'`. There is no boolean entry point, and
`unevaluable` is **never** rounded to `no-match` — "we could not tell" and "it
does not hold" are different answers and an admin acts on them differently.

**A predicted access change asserts or withholds.** `GroupEffectKind` is
`'added' | 'removed' | 'not-predicted'`. `not-predicted` always carries a
`WithheldReason`; it is a quieter way of saying no, never a shrug.

**Withholding is always explained.** `WithheldReason` names six causes:

| Code                                | Meaning                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `rule-unevaluable-after`            | Another active rule on the group could not be evaluated, so we do not know it fails to hold them |
| `another-active-rule-still-matches` | A different active rule keeps the membership; it is named                                        |
| `membership-not-credited-to-rule`   | Not rule-bucketed at all, so no rule's verdict can take it away                                  |
| `membership-attribution-deduced`    | Rule-bucketed, but _which_ rule was deduced rather than established                              |
| `rule-inactive`                     | The only implicated rules are `INACTIVE`; they place nobody                                      |
| `app-mastered-group`                | An `APP_GROUP` roster is managed by its application                                              |

**A membership states its source.** `membershipVerdict()` returns `Rule`,
`Rule · N`, `Direct`, `App`, or `Unresolved`, each with `deduced` set truthfully.

## What may be asserted

- **A membership's source**, when Okta's own provenance names it or the
  classification is `exact`.
- **An access change**, when the rule attribution behind it was established, the
  rule is active, no other active rule still matches, and every implicated rule
  evaluated. A deduced cause cannot support an asserted consequence.
- **A profile source**, read off the app row carrying `features:
PROFILE_MASTERING` — a fact about the user, not a guess from the schema.
- **The group that grants an app**, when the embedded response names it. Where
  scope is `GROUP` and it does not, spend a visible, cancellable call — or say
  the row is unresolved. Never infer it.
- **A dormant-access finding** may assert that no membership write landed, and
  measures age from `groups.lastFullWalkAt`, never from `now`.

## What must be withheld

- **That nobody maintains an access path.** Absence of a write is not absence of
  an owner. The dormant finding states the former and never implies the latter.
- **A removal predicted from a deduced attribution.** An addition that is wrong
  costs an admin a second look; a removal that is wrong costs them access.
- **Anything downstream of an `unevaluable`.** One unevaluable condition
  poisons every conclusion that depended on it.
- **A second-order effect.** Prediction runs one pass. A rule that fires because
  another rule fired is not chased — compounding a model's own error does not
  make it more certain, and the panel says plainly that it stops at one hop.
- **A regex-matched group clause.** `isMemberOfGroupNameRegex` is never
  evaluated; the other six `isMemberOf*` forms resolve only from a **complete**
  supplied group list, in both directions.

## Voice

The copy follows from the rule. Neither hedge nor oversell.

- **State the fact, not your confidence in it.** `12 members`, not `about 12
members`. `Added`, not `Likely added`.
- **Name the absence, not the anxiety.** `Not predicted — the rule is inactive`
  beats `results may be incomplete`. A reader can act on the first.
- **Never bolt a disclaimer onto a number.** If a number needs a caveat to be
  honest, the caveat is the fact — show `Checked 3 of 12 apps`, not `12 apps
(approximate)`.
- **A qualifier is a bug report.** Wanting to write "probably" means the software
  does not yet know something it should. Close the gap, or state the narrower
  fact that is true. Do not ship the word.
- **Say what happened, not what was attempted.** An unconfirmed write outcome is
  `unknown`, never `failed` — reporting a failure that did not happen is its own
  false claim.

## Absent is not zero

A fact that has not loaded renders as **absent**, never as `0`, `—`, or `None`.
Zero is an answer; blank is the absence of one, and collapsing them tells an
admin a group is empty when the app simply has not looked.

The same discipline applies one level up: a verb with no wired handler is
**omitted**, not shipped permanently `disabled`. A section that cannot answer its
question says so, and nothing is promoted to fill the empty slot.

## Every withheld answer is scheduled work

A withheld answer is a placeholder, not a resting state. It is the third choice
of three, taken because the first two were not available _yet_ — so it comes with
an obligation: file the gap, so that the feature gets refined into one that can
guarantee its answer rather than sitting behind a reason code forever.

Both of the gaps this section used to list are now closed, which is what the
obligation is for:

- Blast radius could not see a rule's exclusion list, because a cache-served
  `FormattedRule` dropped `conditions.people`. `FormattedRule` now carries
  `excludedGroupIds` beside `excludedUserIds`, and both routes are read.
- A deduced membership attribution was established only on demand, behind a
  per-row click. It is now the ladder's fourth rung and runs automatically for
  anything the first three could not settle.

What remains withheld is `isMemberOfGroupNameRegex`, and that one is not
scheduled work — it is a stated permanent refusal on security grounds. It is the
only entry allowed to sit here indefinitely, and the reason is written down
rather than implied.

Closing a gap is always the better answer than loosening a rule here. The rule is
not the obstacle — it is the thing that keeps the gap visible until someone
closes it.
