import{j as e}from"./iframe-tAvKsVeF.js";import{u as a,M as r,c as i}from"./blocks-CxSch1eI.js";import"./preload-helper-PPVm8Dsz.js";const o=`# 0007 — A basket verb quotes its cost twice, and names its walks

Status: Accepted — 2026-09-15

## Context

\`docs/claims.md\` states the rule this record is an application of:

> **Uncertainty is a defect, not a disclosure:** a feature that cannot state its
> answer with certainty is unfinished, and the fix is to go and find out — fetch
> the missing field, or narrow the question until it is answerable. Shipping a
> qualifier is not an option.

Selection verbs put that rule under real pressure for the first time, because a
verb has to tell the reader what a run will spend **before** they agree to it,
and a cohort's cost is frequently not a function of the cohort.

Three ticked groups. _Remove the members whose accounts are no longer usable._
How many requests is that? Nobody knows. It is one DELETE per unusable member,
and how many of those there are is a fact about Okta's data, not about the three
ids in the basket. The basket carries \`{kind, id, name}\` and nothing else.

The obvious shapes all fail, and it is worth writing down why, because each one
looks reasonable for about a minute:

- **Quote a range.** _"Takes 3 to 900 requests."_ This is the qualifier the rule
  forbids, wearing a number's clothes.
- **Quote a floor.** _"Takes at least 3 requests."_ Same defect, and worse: the
  number the reader remembers is the one that turned out to be wrong by two
  orders of magnitude.
- **Quote nothing and just run it.** The panel's whole posture is that spend is
  visible before it happens (\`docs/scheduler.md\`). A destructive run is the last
  place to drop that.
- **Guess the page count.** Multiply the group count by some assumed average
  membership. This is a projection presented as arithmetic, which is the exact
  failure mode \`docs/claims.md\` exists to prevent.

## Decision

**Two quotes, each exact, for two different things.**

- \`verb.cost(basket)\` prices **reaching the verb's answer**. For a verb that
  declares a \`preflight\`, that is the cost of the preflight — which _is_
  arithmetic over the basket, because it is one read per ticked entity.
- \`preflight.cost\` prices **the run those findings authorise**, computed from
  what the preflight actually counted.

So the reader agrees twice, to two exact numbers, rather than once to an
invented one. The confirm is built entirely from the preflight — its per-entity
\`lines\` and its cost — so no confirm in this app can quote a figure that nothing
measured.

**And a paginated walk is named, not folded in.** \`VerbCost\` carries an optional
\`walks\` beside \`requests\`:

> _"Takes 14 requests and 2 membership walks."_

That sentence is complete and entirely true. A walk's length is decided by
Okta's data; naming it reports precisely what is known and precisely what is
not, without a single hedging word. Each walk then declares its own per-page
estimate to the scheduler as it goes, which is the mechanism this app already
uses to price an unknown-length walk, and the \`ActivityBar\` shows the ledger
rising live.

## Consequences

**A write verb costs two round trips, by design.** _Remove inactive members_
walks memberships to count, then the bulk runner walks them again to act. That
is a real, accepted expense — and the run's quote says so rather than counting
only the DELETEs, which would understate it. Buying it back by having the
preflight hand its member lists to the run is possible, and was not done: the
run would then act on a membership snapshot taken before the reader read the
confirm, which trades an honest cost for a stale one.

**\`writes\` is separate from \`requests\`.** The scheduler budgets requests; the
1,000-entity run cap budgets entities changed. They are different quantities
with different limits, and quoting one where the other was meant is how a
preflight lies. The cap is enforced once, in \`useVerbRun\`, on the preflight's
measured \`writes\` — so a verb cannot forget it, and \`cost.writes\` being truthful
is the only thing a verb has to get right.

**Not every verb needs both quotes.** A converter and a report state their cost
from the basket and skip the preflight entirely, because for them the basket
really is the whole story. \`preflight\` is optional in the contract and required
by convention only of \`write\` verbs — see \`docs/selection-verbs.md\`.

**Where a quote is still an upper bound, it is documented as arithmetic that
overcounts, never as an estimate.** \`activate-rules\` quotes two requests per
ticked rule; a rule already in the target state spends fewer. Overcounting is
safe in a way that undercounting is not — the reader is never surprised by spend
they did not agree to — but it is called out at the \`cost\` function rather than
left for a reader to discover.

## Alternatives considered

**Make \`cost\` async, so one quote can measure.** It is called during render to
label a control, so it must be synchronous and free. Making it async means every
verb list issues requests just to draw itself.

**Put member counts on \`SelectionRef\`.** If a ticked group carried its
\`memberCount\`, a walk's page count would be exact arithmetic and \`walks\` would
be unnecessary. It is the right idea and it is not free: the count is only
available where the row was ticked from, several rungs do not have it, and a
partially-populated field would make the quote exact for some groups and absent
for others — which is worse than a uniform honest one. Worth revisiting if a
future rung gives every tick a count.
`;function s(t){return e.jsxs(e.Fragment,{children:[`
`,e.jsx(r,{title:"Documentation/ADRs/0007 Verb Cost In Two Quotes"}),`
`,e.jsx(i,{children:o})]})}function d(t={}){const{wrapper:n}={...a(),...t.components};return n?e.jsx(n,{...t,children:e.jsx(s,{...t})}):s()}export{d as default};
