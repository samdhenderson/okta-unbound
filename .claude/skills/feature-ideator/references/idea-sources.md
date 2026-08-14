# The four idea sources, as methods

Each source is a repeatable procedure, not a prompt. Work whichever fits the ask; work
all four when the question is open-ended ("what should we build next?").

---

## Source 1 — Walk an admin job

**Method.** Pick a job from `admin-jobs.md`. Break it into the steps an admin actually
performs. For each step ask: does the app support this, does it support it in the wrong
direction, or is it absent? The gap is almost never the whole job — it is one step in
the middle.

**Why direction matters more than presence.** The clearest example is offboarding.
`removeDeprovisioned` clears deprovisioned members from a _group_, so an admin must
already suspect which groups to check. The job runs the other way: a person left, and
the question is everything they still hold. Same data, same endpoints, opposite
traversal — and the app answers only one direction. Look for this pattern
deliberately; it produces high-value ideas with low build cost, because the
primitives already exist.

**Failure mode to avoid.** Do not invent a job. If a proposed feature cannot be traced
to a step in a real workflow, say so and let it stand or fall on that.

---

## Source 2 — The capability-surface diff

**Method.** Compare the endpoints the API offers against the endpoints the app calls.
Every unused endpoint is a latent feature; the interesting ones are those answering a
question no shipped surface can.

**The recipe** — resources the app actually touches, excluding test fixtures:

```
grep -rhoE '/api/v1/[a-zA-Z-]+' src --exclude='*.test.*' --exclude='*.stories.*' \
  | sort -u
```

As of this writing that returns seven resources: `apps`, `devices`, `groups`, `idps`,
`policies`, `users`, `zones`. Diff that against the endpoint index in the **`okta-api`**
skill.

**What the diff currently surfaces**, ordered by the size of the question each unlocks:

| Unused                                                  | The question it answers                                      | Note                                                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `/api/v1/logs`                                          | _When, who, and what changed_ — the whole temporal dimension | The largest gap. Underpins four separate admin jobs.                                                                           |
| `/users/{id}/roles`, `/groups/{id}/roles`, `/iam/roles` | Who can administer what                                      | Nothing today answers it. Group-granted roles are invisible in a user's own listing.                                           |
| `/api/v1/mappings`                                      | Where a profile attribute actually comes from                | A blank mapped attribute is a leading cause of rules silently not matching.                                                    |
| `/users/{id}/linkedObjects/{name}`                      | Manager and report relationships                             | Not a profile field, so invisible to any report that only walks users.                                                         |
| `/api/v1/authenticators`                                | Org-level authenticator configuration                        | The enrolment-vs-enforcement gap.                                                                                              |
| `/apps/{id}/group-push/mappings`                        | Push mappings **with activation status**                     | The app infers push mappings from `/apps/{id}/groups`, which carries no status — so presence is not proof a mapping is active. |
| `/api/v1/behaviors`                                     | Why a risk-based policy rule triggered                       |                                                                                                                                |
| `/api/v1/sessions/me`                                   | Whether the session will outlast a long job                  | Cheap; would let a bulk run warn before failing mid-way.                                                                       |
| `/meta/schemas/user/*`                                  | Which custom attributes exist, authoritatively               | Currently discovered by sampling loaded rows.                                                                                  |

**Discipline.** An unused endpoint is a _lead_, not an idea. It becomes an idea only
once paired with a job from source 1. "We could call `/api/v1/brands`" is not a feature.

---

## Source 3 — Stated versus shipped

**Method.** Read what the documentation promises, then verify it against the code.
Gaps between the two are usually the highest value per unit of effort available,
because the expectation already exists in a user's head — the feature is _believed_ to
be there.

**Where to look.** `README.md`, `docs/features-plan.md` ground rules, ADR consequence
sections, and any exported function with no caller.

**The cheapest detector** — an export nothing imports is a promise with no delivery
path:

```
npm run knip
```

**Live examples**, found by exactly this method:

- **The audit log has no undo.** `UndoAction.status` admits `'undone'`, and nothing in
  the codebase ever writes it. `features-plan.md`'s ground rule states that prior state
  is captured "so undo can _restore_, not just log" — it logs. The History tab is a
  record, not a remedy.
- **`auditStore.exportAuditLog()`, `getStats()`, and `updateSettings()` have no UI
  caller**, so documented CSV export and configurable 30–365 day retention do not ship.
- **User lifecycle actions write neither an audit entry nor an undo entry**, unlike
  every other mutation in the app — a direct exception to "every mutation audits."

**Framing matters when writing these up.** A stated-vs-shipped gap is a discrepancy
report, not a feature pitch. Present the discrepancy, then the two honest options:
build the missing behaviour, or correct the claim. Both are legitimate; picking one is
the reader's call.

---

## Source 4 — Expired parking rationales

**Method.** A parked or rejected idea carries a _stated reason_. Extract the reason,
ignore the conclusion, and test whether the reason still holds. Reasons expire —
because the codebase gained a capability, or because Okta changed.

**Two recorded precedents, both from this repo:**

- **Feature F (OEL Sandbox)** was parked because "no Okta evaluate-expression API means
  building a custom EL interpreter, high effort." That interpreter now exists as
  `shared/ruleEvaluator.ts`. The parking note records the rationale as _superseded_,
  and Feature H is the affordable slice that became visible once it was.
- **`expand=group-rules`** was treated throughout the codebase as a private,
  undocumented admin-console parameter. Okta documented it and took it **GA on 3 June
  2026**, alongside a new documented endpoint,
  `GET /api/v1/groups/{groupId}/users/{userId}/group-rules`. Several code comments
  still describe it as private. Status changes in the _useful_ direction too, and stale
  "this is unsupported" claims outlive the fact.

**Where to check whether an Okta-side reason expired:** the release notes, which are
far easier to search in the docs source repo than on the client-rendered site. The
`okta-api` skill carries the recipe in `references/doc-sources.md`.

**Two reasons that do not expire**, so do not re-litigate them: single-tenancy (an
architectural property, not a gap) and never handing data to a third party (a privacy
commitment, not a cost trade-off).

**How to re-propose honestly.** Name the original rationale, state precisely what
changed, and say what the idea now costs. A re-proposal that does not engage the
recorded reason reads as not having read it.

---

## Source 5 (lighter) — Friction in what already ships

**Method.** Take a shipped surface and walk it as an admin under time pressure. UX
ideas rather than feature ideas, and usually small.

Productive angles:

- **Loading, empty, and error states** — is an empty result distinguishable from a
  failed one, and from a not-yet-loaded one? The app already treats this seriously
  (`GroupPushSection` distinguishes "not pushed" from "never loaded"); the bar is
  consistency.
- **Manual-load affordances.** Several expensive reads are deliberately opt-in behind a
  button that explains the cost. Ideas here are about whether the explanation is
  legible, not about removing the gate.
- **Honest degradation.** Policy reads commonly 403 for non-super-admins and degrade to
  em dashes. Anywhere that fails hard instead is a bug-shaped idea.
- **Keyboard and navigation** — the view stack, breadcrumbs, focus restoration.
- **Where a number is shown without its meaning.** Two counts can answer different
  questions (attributions, which can exceed the member total, versus people). A figure
  whose basis is not stated is a small correctness idea.

Check against `docs/ux-guidelines.md` before writing one up.

---

## Combining sources

The strongest ideas appear in **two sources at once**, and the overlap is worth hunting
deliberately:

- A job with no support (source 1) **and** an endpoint never called (source 2) → a
  genuine capability gap. _Admin privilege audit_ is the clearest current example.
- A promise not kept (source 3) **and** a job that depends on it (source 1) → a
  credibility gap, usually cheap to close. _Undo that does not undo_ is this.
- An expired rationale (source 4) **and** a primitive that now exists (source 1's reuse
  map) → a feature that quietly became affordable while nobody was looking.

An idea appearing in only one source is not weak, but it should be labelled with which
source produced it, so the reader can weigh it.

## Anti-patterns in ideation

| Anti-pattern                                                             | Why it fails                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Proposing what the demo would look like rather than what the question is | The house format leads with the admin's question for this reason                                  |
| Volume over specificity                                                  | Twelve uncosted ideas transfer the triage work back to the reader                                 |
| Ignoring the reuse map                                                   | An idea that reinvents `runBatch`, `BulkTargetList`, or `ProgressContext` reads as ungrounded     |
| Estimating a write feature as if it were a read feature                  | Audit, confirmation, prior-state capture, and usually an ADR are part of the cost                 |
| Collapsing an honest "unknown" to look tidier                            | The app deliberately surfaces `unevaluable` and `cannot-determine`; removing that is a regression |
| Re-proposing a rejected idea without naming its rejection                | Both plan docs record rationale specifically to prevent this                                      |
