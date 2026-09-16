import{j as e}from"./iframe-tAvKsVeF.js";import{u as s,M as a,c as i}from"./blocks-CxSch1eI.js";import"./preload-helper-PPVm8Dsz.js";const r=`# 0005 — \`ContextBar\` carries session chrome, and that is a closed list of two

Status: Accepted — 2026-09-12

## Context

\`docs/page-shell.md\` §"Two bars, two subjects" is one of the load-bearing rules of
the shell. \`ContextBar\` describes **the live Okta tab**; \`PageHeader\` describes
**what you are browsing**; the two must not converge, and the division is enforced
by removing overlap rather than by asking two adjacent bands to be read carefully.
The rule closes with a sentence that is about to become false:

> \`ContextBar\` holds a subject and the verbs that act on the live tab.

The entity-selection basket needs a control in the chrome. Its count has to be
visible from every rung, because the whole point of the basket is that a cohort is
assembled **across** rungs — users from a group's filtered member list, a group
from the Groups rung, a rule noticed in passing. A control that lives inside a tab
can only report what that tab contributed, which is the one thing the reader does
not need to be told.

So the question is not where the control fits nicely. It is whether \`ContextBar\`
is allowed to hold a control whose object is **neither** band's subject: the
basket is not the live Okta tab, and it is not the rung being browsed.

## The forced choice

Three options, and none of them is free.

**Put it in \`PageHeader\`.** Wrong subject in a different way — \`PageHeader\`
describes one entity, and the basket is a set spanning several kinds. It also
disappears on any rung with no header, and it would re-mount per rung, so the
count would flicker as you navigate.

**Give the basket its own band.** Honest about the subject, and unaffordable. The
shell budgets roughly 91px of fixed chrome at 360px across \`ContextBar\`, the rail
and \`ActivityBar\`; a fourth band would have to publish its own measured height and
would take room from the one scroller.

**Admit that \`ContextBar\` already holds something neither band owns.** It does.
\`docs/action-bars.md\` §"Refresh is app chrome" puts exactly one refresh in the top
bar, on every rung, in every tab — and refresh's object is _the panel_, not the
live tab and not the browsed entity. The rule as written was already an
approximation of the code.

## Decision

**\`ContextBar\` carries two things: the live tab's identity, and _session chrome_.**

Session chrome is a control whose object is **the panel session itself** — not the
live Okta tab, not the rung being browsed. It is a closed list of two:

1. **Refresh** — re-read whatever the panel is showing.
2. **Selection** — how many entities are in the basket, and the way into managing
   them.

\`docs/page-shell.md\` is amended in the same change to state the category and its
members, so the instruction is where a reader looks it up.

**The test for admitting a third member**, which exists so this does not become a
junk drawer:

- Its object is the **session**. If it acts on the live Okta tab it belongs to the
  first category; if it acts on one entity it belongs to \`PageHeader\`.
- It is **meaningful from every rung**. A control that is inert on six of nine tabs
  is a tab's control that escaped.
- It **fits on one line at 360px** without displacing the subject. The band does
  not grow, and the subject name is already competing for width.

A candidate that fails any of the three does not get in, and the list stays at two
until one does. Adding a third is itself a decision worth a record.

## Consequences

**The subject rule survives, narrowed rather than broken.** Neither band may
describe the _other's_ entity — that is still the convergence the rule exists to
prevent, and it is untouched. What the rule no longer claims is that everything in
\`ContextBar\` is about the live tab.

**The selection control must not disturb the trailing group.** The trailing group
is built so that the verb under the pointer never changes identity; a count that
grows from \`1\` to \`12\` would shift Refresh on every tick. Selection therefore sits
**left** of Refresh and expands **leftward**, out of flow, over the identity region
— the same thing the handoff offer already does.

**At zero it is absent, not \`(0)\`.** \`docs/claims.md\`: a verb with nothing to act
on is omitted. There is no reading state to represent either, because the basket is
held in memory (see \`sidepanel/selection/selectionStore\`), so it is never
"not yet known" — the count is either a real number or there is nothing to count.

**The cost we accept.** A reader glancing at the top of the panel now sees one
band mixing two kinds of fact: where Okta is, and what this session has
accumulated. That is a real loss of purity, and it is the price of the count being
visible from the rung where the next tick happens. The alternative costs a band we
do not have, and it is the reason this record exists rather than a line in a spec.
`;function o(t){return e.jsxs(e.Fragment,{children:[`
`,e.jsx(a,{title:"Documentation/ADRs/0005 Session Chrome"}),`
`,e.jsx(i,{children:r})]})}function l(t={}){const{wrapper:n}={...s(),...t.components};return n?e.jsx(n,{...t,children:e.jsx(o,{...t})}):o()}export{l as default};
