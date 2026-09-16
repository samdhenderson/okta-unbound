import{j as e}from"./iframe-tAvKsVeF.js";import{u as a,M as r,c as o}from"./blocks-CxSch1eI.js";import"./preload-helper-PPVm8Dsz.js";const i=`# Selection verbs

What the selection basket can be made to **do**, and the contract every one of
those things is declared through.

Read this when you are adding a verb, changing what a pane offers, or wondering
why a confirm quotes the number it quotes. The basket itself — what it holds,
how it is keyed, why it is never persisted — is \`docs/adr/0005-session-chrome.md\`
and \`docs/adr/0006-saved-collections.md\`. The reasoning behind the cost contract
is \`docs/adr/0007-verb-cost-in-two-quotes.md\`.

## The shape

One interface, \`src/sidepanel/selection/verbs/types.ts\`:

\`\`\`ts
interface BasketVerb {
  id: string;
  label: string; // what fits a control at 400px
  title: string; // the full sentence; also the accessible name
  path: 'convert' | 'write' | 'read';
  needs: readonly SelectionKind[];
  isAvailable?(basket): boolean;
  unavailableReason?: string;
  cost(basket): VerbCost;
  prepareFields?(context): Promise<readonly VerbField[]>;
  preflight?(context): Promise<VerbPreflight>;
  run(context, preflight?): Promise<VerbOutcome>;
}
\`\`\`

A verb is **data**, never children — the same rule an \`ActionDescriptor\` follows
(\`docs/action-bars.md\`). The panes render from the descriptor, the run surface
executes from the same descriptor, and neither knows which verb it is holding.
Adding a verb is adding one module under \`selection/verbs/definitions/\`; the
registry picks it up through \`import.meta.glob\` and nothing else changes.

## \`needs\` is the whole gating story

A verb names the partitions it acts on. It does not appear until every one of
them is non-empty.

That is what makes a **combination verb** free. \`add-users-to-groups\` declares
\`needs: ['user', 'group']\` and simply is not there until both are ticked — no
cross-kind section, no strip that recomposes itself as rows are ticked, no verb
rendered disabled for want of an object. A verb with no object is omitted
(\`docs/claims.md\`).

\`isAvailable\` is the rare extra condition — _an overlap of one group is not a
question_. A verb that declares one **must** also declare \`unavailableReason\`,
and \`registry.test.ts\` fails the build otherwise. The reason is that the two
absences are different facts and are reported differently: an empty partition
explains itself, so the pane names the kind; an extra condition cannot be
inferred from the basket, so the verb states it. Collapsing both into "nothing
here" loses the reader's next action.

## \`path\` routes the verb to its pane

| \`path\`    | Pane      | What it may touch                            |
| --------- | --------- | -------------------------------------------- |
| \`convert\` | Selection | the basket only — beside the roster it edits |
| \`write\`   | Actions   | Okta                                         |
| \`read\`    | Reports   | nothing; it answers a question               |

A converter is additive **by construction**, not by convention: \`VerbContext\`
hands it \`addMany\` and there is deliberately no \`clearKind\` on it, so no verb
can discard what the reader ticked.

A pane with no verbs stays, and says which of the two absences it is in. A tab
strip that grew a seat as each verb landed would be chrome reshuffling under the
reader, which is the thing the panes exist to prevent.

## Naming

Object then effect, from the reader's side.

- \`title\` is the full sentence and carries the object — _Add these groups'
  members to the user selection_. It is also the control's accessible name.
- \`label\` is what fits at 400px. Short, never shortened into ambiguity: if the
  label cannot say what the verb acts on, the verb is misnamed rather than the
  panel narrow.
- \`title\` must be strictly longer than \`label\`; the registry test pins it,
  because a title that is merely the label again means the verb never said what
  it acts on.

Name what the thing **is**. \`remove-inactive-members\` removes deactivated,
suspended _and_ locked-out members, and says all three — a reader who confirms
"remove deactivated members" and finds suspended colleagues gone was misled by a
label.

## Cost is quoted twice, and both quotes are exact

\`\`\`ts
interface VerbCost {
  requests: number; // arithmetic over the basket
  walks?: number; // paginated walks, named rather than guessed at
  writes: number; // entities changed; 0 for read and convert
}
\`\`\`

- **\`verb.cost(basket)\`** prices reaching the verb's answer. For a verb with a
  preflight, that is the cost of the **preflight**.
- **\`preflight.cost\`** prices the **run** the preflight authorises.

Never one number for both. How many of a group's members are deactivated is not
a fact the basket holds, so pricing that write from the selection alone would be
a projection, and a confirm quoting a projection is the confidently-wrong number
\`docs/claims.md\` forbids. See ADR-0007.

\`walks\` exists for the same reason. A membership walk's length is decided by
Okta's data, not by our arithmetic. _"3 requests and 3 membership walks"_ is a
complete true statement; folding an invented page count into \`requests\` is not.
Each walk declares its own per-page estimate to the scheduler, which is how
every other walk in this app is priced (\`docs/scheduler.md\`).

Counts, never durations. How many requests a run issues is a fact this app can
state; how long they will take is one it would be guessing at.

## The run surface

\`components/selection/run/useVerbRun.ts\` drives every verb through the same
stages, and \`VerbRunner.tsx\` renders them:

\`\`\`
idle → [preparing → compose] → [measuring] → confirm → running → results
\`\`\`

- **preparing / compose** — only for a verb declaring \`prepareFields\`. The
  options come from the org (which profile attributes exist is a schema read,
  not a constant). The confirm is withheld until every \`required\` field holds a
  non-blank value, so no verb re-validates its own inputs.

  One answer can decide what the next question _is_: which profile attribute you
  picked decides whether its value is free text, a number, or one of a fixed
  set. A field marked \`refreshesFields\` re-runs \`prepareFields\` with the answers
  so far, so the dependent fields are built knowing it. Answers to fields that do
  not drive the refresh are dropped — the question they answered is not the
  question now being asked — and \`Continue\` stays withheld while the list is
  rebuilt, rather than being offered against a stale form.

  **The options may carry what the selection holds now.** A \`VerbFieldOption\`
  can bring a \`distribution\` — the same \`memberAnalytics\` breakdown the group
  Insights tab draws — and a field whose options do renders as
  \`optionLayout: 'list'\`: a row per option, with its spread, instead of a
  dropdown. A \`<select>\` shows a label and nothing else, and choosing which
  attribute to overwrite across a cohort is a decision about the values already
  there. A field's own \`distribution\` renders above its control and is **inert**:
  it states what is there, and a set of rows where \`(none)\` cannot be chosen
  would ship an affordance that does nothing.

  A field is free text, a number (\`control: 'number'\`), or a picker (\`options\`).
  There is deliberately no checkbox: a two-state control cannot say
  _unanswered_, so a boolean attribute is offered as a two-option picker, and a
  bulk write never defaults silently to \`false\`. Whatever is typed is turned back
  into the schema's own type by the same \`coerceDraftValue\` the single-user
  editor uses, so the two surfaces cannot write one attribute as two types; a
  value the attribute cannot hold is refused (\`invalid-value\`) before a single
  user is read.

  **A stop before the measurement is still a refusal.** \`prepareFields\` may find
  there is nothing to offer — an org defining no attribute this app may write, a
  cohort already past the capture cap. It throws a \`VerbRefusal\` (code plus
  sentence) for that, and the machine renders the refusal rather than a failure.
  "There is nothing here to do" and "the inputs could not be loaded" are
  different facts with different remedies, and a reader told the second when the
  first is true goes looking for a fault that is not there. A refusal that
  measured nothing quotes no cost: it is not a run that would be expensive, it
  is one that is not happening.

- **measuring** — the preflight. Nothing is offered while it is out.
- **confirm** — the preflight's own \`lines\` above the exact cost of the run
  those lines authorise, or, for a verb with no preflight, the cost it derived
  from the basket. Nothing else.
- **running** — progress lines only, identifiers and counts. Closing the dialog
  does **not** cancel the run; it stays in the \`ActivityBar\`, which is the
  panel's one cancel control, and the body says so.
- **results** — the outcome, plus the CSV when the run produced rows.

### One read of the selection, not one per stage

A verb's stages are separate calls over the same basket, and a \`refreshesFields\`
answer re-enters \`prepareFields\` every time it changes. \`VerbContext.memo\` is
scratch space belonging to **one run** — made on \`start\`, dropped on \`close\` — so
a verb that reads its cohort spends it once and measures, re-composes and runs
against that read.

It is deliberately not the entity cache. What a verb parks there seeds an undo
capture and decides which entities a write skips, so it must be what Okta said
during _this_ run, not an entry another surface left minutes ago. Its lifetime is
the dialog's, which is exactly the window over which that holds.

### The write cap lives in the machine

\`RUN_WRITE_CAP\` is 1,000 and is enforced once, on the preflight's **measured**
\`writes\`, so every present and future write verb inherits it and none can forget
it. Over the cap the run **refuses whole** — it never truncates to fit.
Truncating would leave Okta holding a change nobody chose while every count on
screen still read as complete. The reader's answer is to narrow the selection,
which is a thing they can do; doing it for them silently is not.

Whenever a run cannot proceed — refused, nothing to do, or a verb whose object is
not ticked — the control that would proceed is **omitted**, never disabled.

## Undo, and what a confirm may not say

Most of these writes are **audited, not undoable**, and \`NOT_UNDOABLE\` in
\`hooks/useUndoAction.ts\` says so with reasons. \`BULK_ADD_USERS_TO_GROUP\`,
\`BULK_REMOVE_USERS_FROM_GROUP\`, \`ACTIVATE_RULE\` and \`DEACTIVATE_RULE\` all sit
there: _"Removing every user again is a new bulk operation with its own cost and
confirmation, not a restore."_ No confirm may imply otherwise.

Two asymmetries worth knowing before writing copy:

- **A rule-fed removal cannot be reversed from this client at all.** Okta writes
  the removed member onto the rule's exclusion list; clearing it needs a rule
  update, and \`ruleWrites.ts\` has only create, delete, activate and deactivate.
  The preflight states this outright, and counts the exclusions per rule — a
  removal run does not just remove people, it mutates the rules that fed them.
- **Turning a rule back on is not an undo.** It re-evaluates the rule against
  every user. Turning one off does not recall the memberships it granted. The
  two sentences are deliberately not mirror images.

The one undoable write is the bulk attribute editor, which extends
\`UPDATE_USER_PROFILE\`.

## Mastering, for a cohort

Okta stamps \`master: { type: 'PROFILE_MASTER' }\` on nearly every base attribute a
real org defines, and \`components/users/profileEditability\` only unlocks one of
those for a user **no profile source reaches**. That is a per-user fact, resolved
in the single-user editor by a per-user app walk.

A cohort cannot afford that walk, so the bulk editor answers the question the org
can settle for everyone at once: \`getProfileSourceApps\` says whether _any_ app
here has \`PROFILE_MASTERING\`.

- **None** — proven, and free whenever the org snapshot has walked the app
  inventory. No user can be reached by a source that does not exist, so those
  attributes are offered.
- **One or more**, or an inventory that could not be read to the end — those
  attributes are **omitted**, and the field says how many and why. Which users a
  source reaches is a per-user walk this verb does not make, and an unfinished
  inventory proves nothing at all.

The per-user resolution stays where it is affordable: one user, in the Users tab.

## Exporting a selection

Three export descriptors are scoped to the basket rather than to the org —
\`users-selected\`, \`groups-selected\`, \`group-memberships-selected\` — through a
third \`EntityContextMode\`, \`{ kind: 'from-selection', ... }\`. Each is **listed
only while its partition is non-empty**, so an export with nothing to export is
absent rather than disabled, and the Export tab returns to the hub if the last
tick of a configured descriptor's kind is removed.

Three rules hold there for the same reasons they hold for a verb:

- **Exactly the ticks, one request each, in pick order.** 128 ticks are 128
  requests through the scheduler. The filter box is deliberately not appended —
  a filter over a chosen set can only remove rows the reader chose, which is not
  a filter, it is a quiet truncation.
- **A shortfall is stated, not inferred.** Only a 404/410, or a row that fails
  the descriptor's zod schema, counts a tick as missing; an expired session or a
  429 fails the whole export, because a CSV silently shaped by a dead session is
  a wrong answer rather than a short one. The missing count is shown before the
  download **and stamped into the filename**, so the reader knows what they are
  holding after the file leaves the screen.
- **No count the mode cannot support.** A from-selection export shows the tick
  count, which is exact and free. It never shows a whole-org match count.

## Adding a verb

1. Write \`selection/verbs/definitions/<concern>.ts\`, default-exporting the verb
   or an array of them. \`cleanup.ts\` is the reference for a \`write\` verb with a
   preflight.
2. Name it object-then-effect. \`title\` longer than \`label\`.
3. Make \`cost\` exact arithmetic. If you cannot state it exactly, narrow the
   question until you can — shipping a qualifier is not an option
   (\`docs/claims.md\`).
4. Multi-call work goes through \`context.api.runOperation\`, never a hand-rolled
   \`Promise.all\` or \`for await\` (\`docs/scheduler.md\`).
5. A \`write\` verb declares a \`preflight\`. A confirm may only quote what
   something measured.
6. \`status\` is the gate; \`summary\` is the copy. Nothing branches on a sentence.
7. Add a unit test beside it. \`registry.test.ts\` already enforces the
   descriptor's invariants against every registered verb.

## Out of scope, on purpose

**Apps and policies get no verbs.** This client only reads them, so a ticked app
has nothing here to do — stated once in the Actions pane's own copy rather than
implied by an absence.

Destructive lifecycle (deactivate a user, delete a group, delete a rule, clear
sessions, reset factors) and set arithmetic against saved collections are later
cuts, not oversights.
`;function s(t){return e.jsxs(e.Fragment,{children:[`
`,e.jsx(r,{title:"Documentation/Selection Verbs"}),`
`,e.jsx(o,{children:i})]})}function c(t={}){const{wrapper:n}={...a(),...t.components};return n?e.jsx(n,{...t,children:e.jsx(s,{...t})}):s()}export{c as default};
