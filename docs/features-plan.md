# Features plan (living)

Start here to scope or pick up **new feature** work (as opposed to maintainability
work, whose 2026-07 overhaul is complete — see `CLAUDE.md` and `docs/adr/`). This is
a living catalog: add ideas, check items off, record why something was parked so it
isn't re-litigated.

The single fact that reshapes everything: **the write surface is narrow and the session
is single-tenant**. Today the app can `suspend`/`unsuspend` users,
`resetPassword(sendEmail=true)`, add/remove group members, run bulk group ops,
`activate`/`deactivate` rules, **create / delete group rules** (Feature A4 — zod-validated,
via the safe create → activate → retire sequence), and — since
[ADR-0035](./adr/0035-the-first-profile-write.md) — a **single-user
profile write** (`POST /api/v1/users/{id}`, sparse patch, gated on schema mutability and
mastering, predicted, audited and undoable). It still has **no** bulk profile write, no
user `activate`/`reactivate`, no in-place rule edit, no app-push writes, and no policy
ops. Every API call targets one browser tab's Okta session — two
tenants at once is impossible. See [architecture.md](./architecture.md).

**Ground rules for every feature below** (the code must satisfy these):

- All Okta traffic goes through the `ApiScheduler` path — never a direct
  side-panel→content call. Bulk jobs loop through it (5 concurrent, cooldown at 10%
  quota). ([architecture.md](./architecture.md))
- Odyssey tokens only (no raw hex); shared components only (no hand-rolled
  `button`/`input`/`select`/`textarea`); `Modal` for every overlay (role/trap/Esc).
  ([design-system.md](./design-system.md), [components.md](./components.md),
  [ux-guidelines.md](./ux-guidelines.md))
- Validate every new Okta response with zod at the boundary (no new `any`, ADR-0006).
- No raw `console.*`; never log tokens/bodies/PII ([development.md](./development.md)).
- **Every mutation audits, and every destructive mutation confirms.** Capture prior
  state so undo can _restore_, not just log. Components < ~300 lines; logic in hooks.
- Document exports with TypeDoc.

> **Rockstar replacement:** the drive to fully replace rockstar has its own roadmap in
> [rockstar-parity-plan.md](./rockstar-parity-plan.md). Features **C** and **D** below are
> absorbed there as Phase 5.

Status legend: `[ ]` todo · `[~]` partially done · `[x]` done.

---

## Reuse map (build on these, don't reinvent)

| Need                                    | Reuse                                                              | Path                                                         |
| --------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| Bulk loop + per-item error capture      | `executeBulkOperation`, `removeDeprovisioned`                      | `hooks/useOktaApi/groupBulkOps.ts`, `groupCleanup.ts`        |
| Progress UI (count / % / ETA / cancel)  | `ProgressContext` + `ActivityBar`                                  | `contexts/ProgressContext.tsx`, `components/ActivityBar.tsx` |
| Multi-select state (survives filtering) | `useGroupSelection`, `Checkbox`                                    | `hooks/useGroupSelection.ts`                                 |
| List entry (paste/search → chips)       | `Textarea`, `Input`, `SelectionChips`, `ComparisonSearchPhase`     | `components/shared/`, `users/comparison/`                    |
| Confirm / destructive gate              | shared `Modal`                                                     | `components/shared/Modal.tsx`                                |
| Audit + undo                            | `logAction`, `logBulkRemoveAction`, `AuditLogViewer`               | `shared/undoManager.ts`, `components/AuditLogViewer.tsx`     |
| Prior-state capture + restore           | `logProfileUpdateAction`, `useUndoAction` (drift-checked rewrite)  | `shared/undoManager.ts`, `hooks/useUndoAction.ts`            |
| Rule read + write                       | `getGroupRulesForGroup`; `ruleWrites` (create/delete/(de)activate) | `groupDiscovery.ts`, `hooks/useOktaApi/ruleWrites.ts`        |
| Population diff (who gains/loses)       | `classifyGroupImpact`, `summarizeRuleImpact`                       | `shared/membership/ruleImpact.ts`                            |

> `removeDeprovisioned` spent the interval after the Overview tab was deleted on the
> facade with no call site at all. It is reachable again from the group-detail rung —
> `GroupActionBar`'s **More** tier, behind a count-only confirm, wired by
> `groups/detail/useRemoveDeprovisioned.ts` — and it stays the model for this pattern:
> one aggregate undo entry rather than one per user, an `AuditLogEntry`, an
> `APP_GROUP` guard, and every DELETE paced through `runOperation`.

The two primitives worth building **once** and reusing across C/D:

- **`BulkTargetList`** — paste/CSV or search → resolve via `searchUsers`/`getUserById`
  → removable chips, unresolved entries flagged. Add **saved named lists** (persist in
  `idb`) so an admin can reuse "Q3 offboarding cohort" across sessions.
- **`PreflightSummary`** — "N will change · M skipped · why", shown before any write.
  Nothing mutates until the admin has seen it. This is the biggest trust win.

---

## Catalog (ranked by impact ÷ effort)

| Feature                                | Effort | Impact   | Verdict                          |
| -------------------------------------- | ------ | -------- | -------------------------------- |
| A. Orphan/Clutter + Rule Consolidation | M      | High     | `[x]` **Shipped (flagship)**     |
| B. Rule Impact Preview                 | L–M    | High     | `[x]` **Shipped**                |
| C. Bulk Attribute Editor               | M      | High     | `[ ]` Single-user editor shipped |
| D. Bulk Lifecycle Console              | M      | Med–High | Fast follow                      |
| E. Group Push deploy                   | H      | Med      | Parked                           |
| F. OEL Sandbox (full)                  | H      | Med      | Parked (interpreter now exists)  |
| G. Policy Migrator                     | XL     | Med      | Rejected (single-tenant block)   |
| H. Clause-level rule explainer         | S–M    | High     | `[ ]` **Build**                  |

---

## Shipped (A + B)

**A. Orphan / Clutter Remediation + Rule Consolidation — flagship** `[x]`
All four sub-features landed; the _why_ is captured in the code and ADRs.

- **A1 — Cleanup triage** (`groups/clutterAnalysis.ts::analyzeClutter`): a pure, tested
  classifier over the loaded `GroupSummary[]` fuses empty / duplicate-name / stale /
  missing-description into one 0–100 review score. Surfaced as a **Cleanup** panel inside
  the Groups tab whose category counts are one-click selectors into the existing
  selection → bulk/export machinery — no new mutation surface.
- **A2 — Membership-source insight** (`useGroupSource` +
  `shared/membership/groupSource.ts`): per-group "why does this exist / who feeds it" —
  feeding rules, app-push targets, and a gated manual-vs-rule split. Read-only. Its
  original `GroupSourceModal` shell has since been retired: the content now lives in the
  Group Detail view pushed from the groups list (ADR-0016).
- **A3 — Group merge** (`GroupMergeModal` + `useGroupMerge` +
  `shared/membership/mergePlan.ts`): membership consolidation from the selection bar —
  copy sources into a survivor, empty the sources, block sources fed by an active rule;
  reversible; audited.
- **A4 — Rule consolidation** (`RuleConsolidationModal` + `useRuleConsolidation` +
  `useOktaApi/ruleWrites.ts` + `shared/rules/consolidation.ts`): new zod-validated
  create/delete rule writes to add a target group or merge identical-condition rules, via
  the safe create → activate → retire sequence with `CONSOLIDATE_RULE` undo capture.

**B. Rule Impact Preview** `[x]` — _"who loses access if I deactivate this rule?"_
Answered before the admin commits, read-only, no EL interpreter. Pure population-diff
engine `shared/membership/ruleImpact.ts` (one rules listing + one member fetch per target
group, all on the scheduler path — no per-member fan-out). Each `RuleCard` gains a
**Preview Impact** action, and rule deactivation is now **gated** behind an impact-aware
confirmation (`RuleImpactModal`) that leads with the loss headline. Loss is inferred from
rule targets + exclusions and labeled as such inline.

---

## C. `[ ]` Bulk Attribute Editor — safeguarded profile write (single-user editor shipped)

Mass-edit one profile field (department rename, title change) across many users, without
fighting externally-mastered (AD/HR) profiles.

The schema facts were banked first ([ADR-0033](./adr/0033-admin-authored-profile-display.md)):
`getUserProfileSchema` → `cacheKeys.userSchema`, with `oktaUserSchemaPropertySchema`
capturing `mutability`, `required`, `type`, `enum`/`oneOf` and the `master` block — the
mastering signal this feature's differentiator turns on.

**The single-user inline editor has since landed**
([ADR-0035](./adr/0035-the-first-profile-write.md)), which is most of
this item's machinery. What exists today:

- The write itself — `updateUserProfile` (`POST /api/v1/users/{id}`, sparse patch,
  zod-validated response) plus `getUserRaw`, in `useOktaApi/profileOperations.ts`. Its
  result is **three-state**: `saved` / `failed` / `unknown`, where `unknown` means the
  write may have applied and must never be shown as a failure.
- The per-attribute gate — `components/users/profileEditability.ts`: schema
  `mutability`, per-attribute `master.type`, account-level
  `credentials.provider.type`, and a value-type gate, each lock naming its reason.
- The prediction — `shared/membership/blastRadius.ts`, a pure zero-API engine
  answering "what does this edit do to their group access?", hedged (`likely-*`) or
  withheld with a named reason
  ([ADR-0036](./adr/0036-a-predicted-access-change-is-never-asserted.md)).
- The capture and the restore — `logProfileUpdateAction` with PII caps, and
  `useUndoAction`, the repo's **first undo executor**: re-read, refuse on drift, write
  the prior values, record a linked entry of its own.
- One hook, both surfaces — `useProfileEdit` drives the Profile pane and each column
  of the two-user Compare view.

**Superseded:** the "curated **allow-list**, no login/email footguns" line below was the
original plan and ADR-0035 §3 replaces it. `login` is editable when Okta masters the
account; the mastering signal locks exactly the accounts where a write would be
overwritten or is not ours to make, which is a narrower and more accurate lock than a
blanket deny.

**The cohort source has since landed too.** The Group Detail Members tab is now the
shared member explorer with search, source pills and attribute/MFA filters, and the
Insights tab reports the attribute spread over _every_ browseable attribute with
outlier values marked. That gives the bulk editor a better cohort than paste-and-resolve
ever would: **the filtered set on screen**, entered from Insights → attribute spread →
pick an outlier value → "Normalize N users". Paste/search cohort resolution stays a
fallback for users who are not in one group, not the primary entry point.

What remains for the bulk build:

- **Cohort resolution** — the Members tab's active filter as the primary source;
  paste/search → resolved chips (reusing `BulkTargetList`) as the fallback.
- **Preflight over many users** — one `PreflightSummary` running the existing
  per-attribute gate across the cohort (N updatable / M skipped-locked + reasons,
  capturing old values), then a confirm modal restating the counts.
- **The run** — bulk loop + `ProgressContext` on the scheduler path, with live progress.
- **Results** — updated / skipped / failed summary plus **CSV export** (every cell
  through `csvUtils.escapeCSV`) and the audit entry.
- _Enhancement:_ value **templating** (find-replace / derive-from-existing) with a
  per-user before→after table.
- Done when: an admin can change one field across a resolved cohort, locked profiles are
  auto-skipped with reasons, the change is previewed/confirmed/audited/undoable, green.

**Two hard blockers, both of which must be closed inside the bulk commit:**

1. **Sparse-patch merge behaviour is unverified.** `POST /api/v1/users/{id}` has not
   been checked against a real org, and it is marked `U` in the `okta-api` index.
   Confirm it _before_ fanning the write out across a cohort; the fallback (send the
   full profile, strip everything not `READ_WRITE`) is one function body in
   `profileOperations.ts`. **This one needs a live org — it cannot be closed from the
   repo.**
2. **The undo history cap breaks naive bulk logging.** `undoManager.ts` sets
   `MAX_UNDO_SIZE = 50`, so one entry per user means an 80-user run evicts its own
   early entries and most of the run stops being revertable. Bulk needs **one
   run-scoped entry** holding per-user before-values, which means a new `ActionType` —
   and [ADR-0035](./adr/0035-the-first-profile-write.md) §5 built the forcing function
   on purpose: `NOT_UNDOABLE` is an exhaustive `Record`, not a `switch` with a
   `default:`, so adding the member **is a compile error until someone writes down what
   undoing it means**. The existing caps (25 attributes × 1024 chars) are per _entry_,
   so a run-scoped entry needs its own cohort cap — over-cap users recorded but marked
   unrestorable, never silently truncated (ADR-0035 §4).

**The bulk write needs its own ADR.** ADR-0035 governs the _first_ profile write, of one
user, from a field the admin is looking at. This is the first **many**-user write, driven
by a client-side filter the admin cannot audit row by row. The ADR has to answer: what
the confirm shows (exact `from → to` per user, capped and paginated); cancellation
semantics mid-run; what lands in the undo log; and the hard refusal — **never write an
attribute a feeding rule reads without naming the rule and the membership change it would
cause** (ADR-0036).

---

## H. `[ ]` Clause-level rule explainer — _"why isn't this person in that group?"_

The single most common Okta support question, answered directly. Today an admin can see that a
user doesn't match a rule; they cannot see **which part** of the condition failed.

`shared/ruleEvaluator.ts` now parses conditions into an AST rather than pattern-matching strings,
so each sub-expression can be evaluated independently. For
`user.department == "Engineering" && user.title != "Intern"` against a given user, the UI can show
department ✓ (Engineering) and title ✗ (is "Intern") instead of a bare "no match". This is
effectively impossible without an AST and nearly free with one — which is why it leads the list.

- **Zero API cost.** Pure evaluation over a rule and a user the app has already loaded. No new
  endpoint, no scheduler traffic, nothing to rate-limit.
- Reuse: `tryEvaluateRuleExpression` and the allow-list evaluator in `shared/ruleEvaluator.ts`;
  `analyzeMemberships` already calls it per user/group. The new work is a per-node walk that
  records each clause's operands, its resolved values, and its outcome — then a component to
  render the tree.
- **Must degrade honestly.** The allow-list covers `String.*` plus comparison/logical operators;
  group-membership functions (`isMemberOfGroup*`) return `unevaluable` because they need the
  user's full group list. A clause the evaluator cannot resolve renders as _unevaluable_, never
  as a fail — presenting "couldn't parse" as "didn't match" would be a worse bug than the one
  this feature fixes. Show a per-rule summary like "3 of 4 clauses evaluated, 1 needs group
  context".
- **Highest-leverage follow-up:** supply the user's group list to the evaluator and close the
  `isMemberOf*` seam (documented on `GROUP_MEMBERSHIP_FUNCTIONS`). The app already fetches user
  groups elsewhere, and it would widen this feature — and every other consumer of the evaluator —
  at once.
- Surfaces: the **rule detail rung** in the Rules tab (explain against a picked user), and the
  group detail view's membership-source section (explain why a listed member is attributed to a
  rule). This said "a rule's card" while the rule's detail _was_ a card's disclosure; that body is
  `rules/RuleDetailView.tsx` now, and the clause tree is a new `DetailSection` in its stack —
  which is the room a per-clause breakdown never had inside a list row.
- _Rendering note:_ rule expressions and profile values are end-user-controllable. Rely on React
  escaping; never build HTML strings from them.
- Done when: an admin picks a user and a rule and sees a per-clause pass/fail breakdown with the
  actual profile values that drove each outcome, unevaluable clauses labelled as such, green.

---

## Known tech debt / follow-ups

Carried forward from the A/B build (surfaced while working, none blocking):

- **A4 hardening (highest risk).** The rule create/delete path is the sharpest code in
  the repo and hasn't been exercised against a live tenant. Add a `useRuleConsolidation`
  hook test (mock the write ops) pinning the create → activate → retire sequencing and
  the abort-before-delete guarantee; consider a post-create verification read.
- ~~**A3/A4 audit attribution.**~~ Resolved (`D-013b`): both now resolve the
  current admin through `useOktaApi`'s `getCurrentUser()` facade, same as the
  rule lifecycle. An unresolvable actor records `performedBy: null` with
  `actorResolution: 'unavailable'` rather than a fabricated placeholder — see
  `useRuleConsolidation.ts:237,312-313`.
- **`RulesCache` stores `rawRules: []`.** Anything needing exclusion lists (the impact
  engine) must re-fetch raw rules. Populating `rawRules` once would let impact capture
  skip its rules fetch entirely.
- **Rules tab fetches rules outside the scheduler** (`chrome.tabs.sendMessage` directly),
  unlike the impact capture. Migrating the main rule fetch onto the scheduler path would
  make rate-limiting uniform.
- **A1 orphan signal.** `GroupSummary.hasRules`/`ruleCount` are now populated from
  `RulesCache`, so `analyzeClutter` could add a real **orphan** category/reason on top of
  the existing counts.
- **`useGroupsLoader` mount-rehydrate races `loadAllGroups`** (characterized in its
  docstring) — relevant if A1/A2 start triggering loads.
- **Finish the eyebrow migration.** `Eyebrow` (ADR-0030's recipe, finally extracted) is
  the single uppercase section label, but roughly eighteen files still hand-roll
  `uppercase tracking-*` — `RuleCard`, `ContextBar`, `PolicyCard`, `StatCard`,
  `ColumnPicker`, `PresetControls` and the rest of
  `grep -rl "uppercase tracking" src/sidepanel/components`. Mechanical and exempt from
  the plan gate (ADR-0024), but do it as its own PR: it is the only thing that stops the
  four-recipe drift returning, and each swap is a visual diff worth seeing on its own.
- **Dead-code pass over `src/shared/tabState/`.** `TabStateManager` writes
  `chrome.storage.local` directly, so the background's `saveTabState` / `loadTabState` /
  `clearTabState` message actions (`src/background/index.ts:244`–`300`) have no sender
  anywhere in the codebase — three validated message actions maintained for nobody.
  `RulesTab` is the module's only consumer while its `TabName` union spans every tab.
  While there: the lone `chrome.storage.sync.set` at `src/background/index.ts:326` has no
  reader either (ADR-0033 §2). Run `npm run knip` and remove what it confirms; removing a
  message action is a security-surface reduction, so review it as one.

---

## Detail-page layout contract adoption — pending ADR-0030 migration

ADR-0030 said Users and Groups adopt the contract first. Both have:

- [x] **Groups** — the group detail view pushed from the list, with the header owning
      identity (ADR-0032).
- [x] **Users** — the detail rung is now `UserActionBar` above three tabbed panes of one
      card (`UserDetailPanel`), the header describes the user (`userIdentity`), and
      `UserProfileCard` / `userProfileSections.ts` are deleted rather than restyled.

Four detail-page surfaces still need the `DetailSection` / `ActionBar` /
`EntityLink` / `Badge` contract from [ADR-0030](./adr/0030-detail-page-layout-contract.md):

- [ ] **Rules** (`src/sidepanel/components/RuleCard.tsx`) — hand-rolls an `<a>` with
      an inline `<svg>` instead of `OpenInOktaLink`; "THEN ADD TO GROUPS" chips are
      inert text that should be `EntityLink`s; uses `px-2.5 py-1` padding, which
      `docs/design-system.md` does not sanction; eyebrow uses `tracking-wider` where
      the contract settles on `tracking-wide`.
- [ ] **Apps** (`src/sidepanel/components/apps/AppListItem.tsx`) — expanded body is
      a bespoke 2-column grid of grey field tiles rather than `DetailSection`.
- [ ] **Policies** (`src/sidepanel/components/policies/PolicyCard.tsx`) — eyebrow
      uses `tracking-wider` where the contract settles on `tracking-wide`; bespoke body
      rather than `DetailSection`.
- [ ] **History** (`src/sidepanel/components/AuditLogViewer.tsx`) — **accessibility
      bug, highest priority**: row is a bare `<div onClick>` with no `role`, `tabIndex`,
      or `aria-expanded`, cannot be reached or operated by keyboard.

---

## Parked / rejected (rationale recorded so we don't re-litigate)

- **D. Bulk Lifecycle Console** _(fast follow)_ — paste users → suspend/unsuspend/
  reactivate + trigger reset/activation emails. Extends existing lifecycle ops; the
  "comms engine" is just Okta's built-in `sendEmail` flag. Only new bits:
  `lifecycle/activate` + `reactivate`. Reuses `BulkTargetList` + preflight from C.
- **E. Group Push deploy** — the extension only **reads** push mappings
  (`getAppPushGroupMappings`); writing app group-push config is deep provisioning.
  High effort, parked.
- **F. OEL Sandbox (full)** — _parking rationale superseded._ It was parked because "no Okta
  evaluate-expression API means building a custom EL interpreter, high effort". That interpreter
  now exists: `shared/ruleEvaluator.ts` parses with `jsep` and evaluates against an explicit
  allow-list, returning `match` / `no-match` / `unevaluable`. What remains parked is only the
  _full_ sandbox (arbitrary expression authoring against arbitrary users). **Feature H is the
  affordable slice** of it, and Feature B still covers impact-before-toggling.
- **G. Policy Migrator** — **rejected.** The single-tab session model cannot address two
  tenants at once, and policy ops are entirely absent. Would require a different
  transport plus persisted cross-tenant credentials, violating the never-persist-tokens
  principle ([architecture.md](./architecture.md)). This rejection covers _cross-tenant
  migration_ only; a future single-tenant, read-only Authentication Policies section
  (viewing policies/rules in the current org) is out of its scope.
