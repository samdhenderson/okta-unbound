import{j as e}from"./iframe-tAvKsVeF.js";import{u as s,M as o,c as i}from"./blocks-CxSch1eI.js";import"./preload-helper-PPVm8Dsz.js";const r=`# Claims

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
append a \`?\` to a label it is unsure of.

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

The disclaimer is the easy exit, and it is closed: it converts the app's unsolved
problem into the admin's interpretation problem, silently, because a shipped hedge
looks like diligence.

When the certain answer is not available yet, the order of preference is:

1. **Make it certain.** Fetch, compute, or verify whatever is missing. This is
   the default and it is usually possible.
2. **Narrow the question** until what remains is certain, and answer that. A true
   smaller claim beats a hedged larger one — \`Checked 3 of 12 apps\` is worth more
   than \`12 apps (approximate)\`.
3. **Withhold**, naming the absence and its reason, and file the gap as work.

There is no fourth option. Shipping the claim with a qualifier attached is not on
the list, and neither is shipping it bare and hoping.

A hedge that survives review is a bug that was documented instead of fixed.

The three shapes this takes:

| Situation                      | What ships                                                     |
| ------------------------------ | -------------------------------------------------------------- |
| Evidence supports the claim    | The claim, stated flat: \`Added\`, \`Rule\`, \`12 members\`          |
| Evidence is missing or deduced | A named absence: \`Not predicted\`, \`Unresolved\`, and the reason |
| The fact was never loaded      | Nothing at all — see **Absent is not zero**                    |

### Going and finding out has a written cost

"Make it certain" would be an unbounded instruction without a stopping point, so
rule assessment states its own. An attribution claim comes from the first rung
that can answer, and no rung may be skipped:

1. **Okta's own embed** — \`_embedded['group-rules']\` where the roster carried it.
   Free.
2. **The evaluator, given the user's complete group list.** No API traffic, and
   where nearly every answer should come from. A miss here is a defect _here_.
3. **The org rules listing** — one paginated \`GET /api/v1/groups/rules\`, shared
   org-wide through the entity cache, so the org pays once.
4. **\`GET /groups/{gid}/users/{uid}/group-rules\`, automatically**, for what
   survives rungs 1–3 unsettled. One call per unsettled row, once per row, only
   while the surface is on screen.

Rung 4 is the only one that scales with the row count. **If it fires often, fix
rung 2** — the cost is a symptom, never a budget to spend. The reasoning behind
each rung, and the API budget it commits to, is
[ADR-0001](adr/0001-rule-assessment-certainty.md).

### Blank, absent, and "we cannot read it" are three facts, not one

The line that matters is **what the org holds** versus **what we can see**, and the
evaluator keeps those apart:

| The attribute is…                              | The answer is                      |
| ---------------------------------------------- | ---------------------------------- |
| Present, holding a value                       | That value                         |
| Present holding \`""\`                           | \`""\` — a value, and not "no value" |
| Present and explicitly \`null\`                  | \`null\`                             |
| **Absent from the profile**                    | **\`null\`** — see below             |
| A top-level field missing from the response    | \`unevaluable\`, \`field-not-fetched\` |
| A top-level field we deliberately do not carry | \`unevaluable\`, \`field-not-fetched\` |
| Present but not a scalar                       | \`unevaluable\`, \`operand-type\`      |

**An absent profile attribute is \`null\`, because that is how Okta says "no value".**
Okta's wire format has no other way to express it — a null attribute is simply not
present in the profile object — and Okta EL is SpEL, so \`null == "x"\` is \`false\` and
\`null != "x"\` is \`true\`. Absence is therefore a fact about the org, and it resolves.
Treating it as a gap in our knowledge is what put ~200 unreadable rules in front of an
admin who had asked what one profile edit would change ([ADR-0004](adr/0004-absent-attribute-is-null.md)).

The absence that is genuinely **ours** still withholds. A top-level Okta user field
(\`status\`, \`created\`, \`lastLogin\`, …) resolves from the user root through an explicit
allow-list, because it is real Okta EL and is not on the profile; reading such a field
off the profile would return \`no-match\` for every user. A field on that allow-list but missing
from the response, or one we strip at the boundary (\`credentials\`) and therefore never
see, declines under \`field-not-fetched\`: the org may well hold a value we cannot read,
and \`null\` would assert otherwise.

This split is only sound while "absent" reliably means "the org holds no value". It
rests on the zod boundary preserving org-custom attributes (\`oktaProfileSchema\` is
\`.passthrough()\`) and on no path handing the evaluator a projected profile. **If a
trimmed profile ever reaches the evaluator, that is the bug** — the guarantee above is
what would be wrong, not the table.

### Never guess a function's semantics

Expression coverage grows only where Okta's behaviour is exactly pinnable. A
function whose contract we would have to infer is not a gap to fill: a guess
produces a confident wrong answer, which is strictly worse than the
\`unevaluable\` it replaces. \`shared/ruleEvaluator.ts\`'s allow-list carries the
reason for each refusal beside it, so a settled refusal stays distinguishable
from a stale one.

\`isMemberOfGroupNameRegex\` resolves through \`shared/rules/safeRegex.ts\`
(ADR-0002), which never constructs a \`RegExp\` from tenant text: a hand-written
linear-time engine (Thompson NFA, no backtracking) evaluates the pattern under
hard caps on length, state count, and step budget. A pattern outside its supported syntax
subset, or over a cap, declines rather than guesses: \`unevaluable\` with reason
\`regex-unsupported-syntax\` or \`regex-too-complex\`. The reason sentence still
says the check was not performed. It never says the user failed it.

## Evidence is structural, never lexical

**A decision about correctness never reads a string meant for a human.**

This is the rule that keeps the one above safe. If the code branches on whether a
label says \`Rule\` or \`Rule?\`, then the epistemics live in the copy — and the day
someone edits the copy, the correctness changes silently and no test notices.

Evidence is carried in the type, next to the answer it qualifies:

- \`membershipVerdict()\` returns a \`deduced: boolean\` alongside \`label\` and
  \`variant\`. \`isMembershipAttributionDeduced()\` is the predicate callers gate on.
- \`GroupEffect\` carries \`kind\` plus, when withheld, a \`WithheldReason\` code.
- \`RuleMatchOutcome\` is a three-valued union, not a boolean with a caveat.

Copy is then free to be plain, because nothing depends on its wording. Rename a
badge whenever the wording improves; no gate moves.

Corollary: **a reason code is never a sentence.** \`blastRadius.ts\` ships codes
only — the prose lives in \`shared/rules/unevaluableReasonText\` and the components.
Every string that module touches (rule names, conditions, group names, drafted
values) is end-user-controllable tenant data, which is also why it imports no
logger and must never gain one.

## The vocabularies

Four unions carry every claim the panel makes. Extend these rather than inventing
a parallel scheme.

**Rule evaluation is three-valued.** \`RuleMatchOutcome\` is
\`'match' | 'no-match' | 'unevaluable'\`. There is no boolean entry point, and
\`unevaluable\` is **never** rounded to \`no-match\` — "we could not tell" and "it
does not hold" are different answers and an admin acts on them differently.

**A predicted access change asserts or withholds.** \`GroupEffectKind\` is
\`'added' | 'removed' | 'not-predicted'\`. \`not-predicted\` always carries a
\`WithheldReason\`; it is a quieter way of saying no, never a shrug.

**Withholding is always explained.** \`WithheldReason\` names six causes:

| Code                                | Meaning                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| \`rule-unevaluable-after\`            | Another active rule on the group could not be evaluated, so we do not know it fails to hold them |
| \`another-active-rule-still-matches\` | A different active rule keeps the membership; it is named                                        |
| \`membership-not-credited-to-rule\`   | Not rule-bucketed at all, so no rule's verdict can take it away                                  |
| \`membership-attribution-deduced\`    | Rule-bucketed, but _which_ rule was deduced rather than established                              |
| \`rule-inactive\`                     | The only implicated rules are \`INACTIVE\`; they place nobody                                      |
| \`app-mastered-group\`                | An \`APP_GROUP\` roster is managed by its application                                              |

**A membership states its source.** \`membershipVerdict()\` returns \`Rule\`,
\`Rule · N\`, \`Direct\`, \`App\`, or \`Unresolved\`, each with \`deduced\` set truthfully.

## What may be asserted

- **A membership's source**, when Okta's own provenance names it or the
  classification is \`exact\`.
- **An access change**, when the rule attribution behind it was established, the
  rule is active, no other active rule still matches, and every implicated rule
  evaluated. A deduced cause cannot support an asserted consequence.
- **A profile source**, read off the app row carrying \`features:
PROFILE_MASTERING\` — a fact about the user, not a guess from the schema.
- **The group that grants an app**, when the embedded response names it. Where
  scope is \`GROUP\` and it does not, spend a visible, cancellable call — or say
  the row is unresolved. Never infer it.
- **A dormant-access finding** may assert that no membership write landed, and
  measures age from \`groups.lastFullWalkAt\`, never from \`now\`.

## What must be withheld

- **That nobody maintains an access path.** Absence of a write is not absence of
  an owner. The dormant finding states the former and never implies the latter.
- **A removal predicted from a deduced attribution.** An addition that is wrong
  costs an admin a second look; a removal that is wrong costs them access.
- **Anything downstream of an \`unevaluable\`.** One unevaluable condition
  poisons every conclusion that depended on it.
- **A second-order effect.** Prediction runs one pass. A rule that fires because
  another rule fired is not chased — compounding a model's own error does not
  make it more certain, and the panel says plainly that it stops at one hop.
- **Any \`isMemberOf*\` clause without a complete group list.** All seven forms,
  including \`isMemberOfGroupNameRegex\` (ADR-0002), resolve only from a
  **complete** supplied group list, in both directions — a partial list is
  worse than none.
- **A regex clause outside the safe engine's supported subset.** A pattern the
  linear-time matcher declines (\`regex-unsupported-syntax\`) or that exceeds its
  length/state/step caps (\`regex-too-complex\`) stays \`unevaluable\`; the engine
  never falls back to \`RegExp\` on tenant text.

## Voice

The copy follows from the rule. Neither hedge nor oversell.

- **State the fact, not your confidence in it.** \`12 members\`, not \`about 12
members\`. \`Added\`, not \`Likely added\`.
- **Name the absence, not the anxiety.** \`Not predicted — the rule is inactive\`
  beats \`results may be incomplete\`. A reader can act on the first.
- **Never bolt a disclaimer onto a number.** If a number needs a caveat to be
  honest, the caveat is the fact — show \`Checked 3 of 12 apps\`, not \`12 apps
(approximate)\`.
- **Say what happened, not what was attempted.** An unconfirmed write outcome is
  \`unknown\`, never \`failed\` — reporting a failure that did not happen is its own
  false claim.

## Absent is not zero

A fact that has not loaded renders as **absent**, never as \`0\`, \`—\`, or \`None\`.
Zero is an answer; blank is the absence of one, and collapsing them tells an
admin a group is empty when the app simply has not looked.

The same discipline applies one level up: a verb with no wired handler is
**omitted**, not shipped permanently \`disabled\`. A section that cannot answer its
question says so, and nothing is promoted to fill the empty slot.

## Every withheld answer is scheduled work

A withheld answer is a placeholder, not a resting state. It is the third choice
of three, taken because the first two were not available _yet_ — so it comes with
an obligation: file the gap, so that the feature gets refined into one that can
guarantee its answer rather than sitting behind a reason code forever.

What remains permanently withheld, on the never-guess grounds above, is Okta EL's \`Time.*\` and
\`Convert.*\` functions (rejected by Okta itself inside a group-rule condition),
\`Instant\`/\`DateTime\` (the org's timezone is not readable from where the panel
evaluates), \`String.replaceFirst\` (its target is a Java regex — the same
tenant-pattern hazard ADR-0002 solved for \`isMemberOfGroupNameRegex\`, not yet
extended to this function), and \`Arrays.add\`/\`Arrays.flatten\` (they return a
collection, which is not an operand any comparison here accepts). Each reason
is a stated limit, not an oversight — see ADR-0001 §3. Closing a gap is always the
better answer than loosening a rule here: the rule is what keeps the gap visible
until someone closes it.
`;function a(n){return e.jsxs(e.Fragment,{children:[`
`,e.jsx(o,{title:"Documentation/Claims"}),`
`,e.jsx(i,{children:r})]})}function u(n={}){const{wrapper:t}={...s(),...n.components};return t?e.jsx(t,{...n,children:e.jsx(a,{...n})}):a()}export{u as default};
