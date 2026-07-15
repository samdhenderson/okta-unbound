# Features plan (living)

Start here to scope or pick up **new feature** work (as opposed to the maintainability
backlog in [refactoring-plan.md](./refactoring-plan.md)). This is a living catalog:
add ideas, check items off, record why something was parked so it isn't re-litigated.

These began as six raw ideas and were pruned against what the extension can actually
do cheaply. The single fact that reshapes everything: **the write surface is narrow
and the session is single-tenant**. Today the app can `suspend`/`unsuspend` users,
`resetPassword(sendEmail=true)`, add/remove group members, run bulk group ops, and
`activate`/`deactivate` rules. It has **no** profile write, no user `activate`/
`reactivate`, no rule create/update/delete, no app-push writes, and no policy ops.
Every API call targets one browser tab's Okta session — two tenants at once is
impossible. See [architecture.md](./architecture.md).

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

Status legend: `[ ]` todo · `[~]` partially done · `[x]` done.

---

## Reuse map (build on these, don't reinvent)

| Need                                    | Reuse                                                                  | Path                                                     |
| --------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| Bulk loop + per-item error capture      | `executeBulkOperation`, `removeDeprovisioned`                          | `hooks/useOktaApi/groupBulkOps.ts`, `groupCleanup.ts`    |
| Progress UI (count / % / ETA / cancel)  | `ProgressContext` + `LoadingBar`                                       | `contexts/ProgressContext.tsx`                           |
| Multi-select state (survives filtering) | `useGroupSelection`, `Checkbox`                                        | `hooks/useGroupSelection.ts`                             |
| List entry (paste/search → chips)       | `Textarea`, `Input`, `SelectionChips`, `ComparisonSearchPhase`         | `components/shared/`, `users/comparison/`                |
| Confirm / destructive gate              | shared `Modal`                                                         | `components/shared/Modal.tsx`                            |
| Audit + undo                            | `logAction`, `logBulkRemoveAction`, `AuditLogViewer`                   | `shared/undoManager.ts`, `components/AuditLogViewer.tsx` |
| Action CTAs                             | `QuickActionsPanel`                                                    | `components/overview/shared/QuickActionsPanel.tsx`       |
| Group analysis (overlap/staleness)      | `compareGroups`, `calculateStaleness`, `getAllGroups` (`expand=stats`) | `hooks/useOktaApi/groupAnalysis.ts`, `groupDiscovery.ts` |
| Rule read + activate/deactivate         | `getGroupRulesForGroup`; `handleActivateRule/DeactivateRule`           | `groupDiscovery.ts`, `content/index.ts`                  |

Two new shared primitives are worth building **once** and reusing across A/C/D:

- **`BulkTargetList`** — paste/CSV or search → resolve via `searchUsers`/`getUserById`
  → removable chips, unresolved entries flagged. Add **saved named lists** (persist in
  `idb`) so an admin can reuse "Q3 offboarding cohort" across sessions.
- **`PreflightSummary`** — "N will change · M skipped · why", shown before any write.
  Nothing mutates until the admin has seen it. This is the biggest trust win.

---

## Catalog (ranked by impact ÷ effort)

| Feature                                | Effort | Impact   | Verdict                        |
| -------------------------------------- | ------ | -------- | ------------------------------ |
| A. Orphan/Clutter + Rule Consolidation | M      | High     | **Build (flagship)**           |
| B. Rule Impact Preview                 | L–M    | High     | **Build**                      |
| C. Bulk Attribute Editor               | M      | High     | **Build**                      |
| D. Bulk Lifecycle Console              | M      | Med–High | Fast follow                    |
| E. Group Push deploy                   | H      | Med      | Parked                         |
| F. OEL Sandbox (full)                  | H      | Med      | Parked (B is the cheap slice)  |
| G. Policy Migrator                     | XL     | Med      | Rejected (single-tenant block) |

---

## A. `[ ]` Orphan / Clutter Remediation + Rule Consolidation — flagship

Directories accumulate duplicate-name, empty, and rule-orphaned groups; admins have no
consolidated view, and Okta's UI blocks adding target groups to an existing rule.

**A1 — Clutter scan dashboard** _(Effort: L)_ — `[x]` delivered (read-only triage)
Detection is mostly **local** over the already-fetched group list, so few/no extra
calls. Reuse `getAllGroups({expand:'stats'})`, `calculateStaleness`, `compareGroups`,
`getGroupRulesForGroup`. Detects: exact/normalized-duplicate names; empty groups (0
members); orphans (no feeding rule **and** no app push **and** 0 manual members); stale.
UX: a new **"Cleanup"** view (a scan like `MfaScanPanel`, or a Groups-tab sub-view) with
category cards → each expands to a **selectable results table** (`useGroupSelection` +
`Checkbox`) → selection bar → bulk action.
_Enhancement:_ a single sortable **"safe to remove" confidence badge** that fuses the
signals, so admins triage on one column instead of four.

**Delivered** (branch `claude/high-impact-features`): a **Cleanup** panel _inside_ the
Groups tab (a new selection-bar toggle beside Compare/Bulk/Collections — no new top-level
tab, no clutter). `clutterAnalysis.analyzeClutter` is a pure, tested classifier over the
loaded `GroupSummary[]` that fuses empty / duplicate-name / stale / missing-description
into one 0–100 **review score** with reasons — the "single confidence" enhancement. The
category counts are one-click **selectors** that feed the existing selection → bulk/export
machinery, so cleanup reuses everything and adds no new mutation surface. Scoped honestly
to what's knowable locally: it flags empty/duplicate/stale but does **not** yet claim
rule-orphan status (needs the rules payload — a clean follow-up). A2 (per-group "why does
this exist / who feeds it") and A3/A4 (merge + rule writes) remain open.

**A2 — Membership-source insight** _(Effort: L–M)_
Per group, answer **"why does this exist / who feeds it?"** — feeding rules
(`getGroupRulesForGroup`), app push mappings (`getAppPushGroupMappings`), and the
manual-vs-rule member split. Expandable detail panel per row; this is the safety
context an admin needs before removing anything.

**A3 — Merge / consolidate groups** _(Effort: M)_
Pick a **survivor**, copy source members in (`addUserToGroup` loop via scheduler +
`ProgressContext`), then retire the emptied source. UX: Modal wizard — choose survivor
→ preview member delta (`compareGroups` overlap already computes it) → run → audit.
_Enhancement:_ a **"what breaks" preview** listing every rule/app pointing at the source
before retiring it.
_Safeguard:_ never delete a group with a feeding rule until that rule is repointed/removed.

**A4 — Rule consolidation (the sharp one)** _(Effort: M, needs new writes)_
Okta lets you set multiple target groups only at rule **creation**, not on edit. Work
around it: to add a group, **duplicate** the rule (same expression) with the extra group
in `assignUserToGroups.groupIds`; or **merge** rules with identical/similar expressions
into one carrying the union of groupIds.
New endpoints (follow the `suspendUser`/content-script pattern):
`POST /api/v1/groups/rules`, `PUT /api/v1/groups/rules/{id}`, optionally
`DELETE /api/v1/groups/rules/{id}`. Okta requires a rule be **INACTIVE to edit**, so the
safe sequence — deactivate → mutate → reactivate — reuses the existing rule actions.
UX: from a rule row → "Add target group" (search-select, preview diff, confirm) or
"Merge similar rules" (list matching-expression rules → choose primary → union groupIds
→ deactivate/delete redundant → reactivate).
_Safeguard:_ show a **dry-run diff** (expression + resulting groupIds) before writing;
merging _similar_ (not identical) expressions changes who gets access, so require B's
population delta ("+12 gain, −3 lose") before committing; never delete the source rule
until the merged rule is created and active; audit every create/update/delete.

- Reuse: `groupBulkOps.ts`, `groupAnalysis.ts`, `groupDiscovery.ts`, `content/index.ts`
  rule handlers, `ProgressContext`, `Modal`, `undoManager`.
- Open questions: near-duplicate name + similar-expression thresholds — start with
  exact + normalized (case/whitespace) match; add fuzzy later.
- Done when: an admin can scan, understand _why_ a group exists, merge two groups, and
  add a group to a live rule — each behind a dry-run/preflight, each audited, tests green.

---

## B. `[x]` Rule Impact Preview — the cheap slice of the OEL sandbox

Admins want to know _who a rule affects_ before flipping it, without an EL interpreter
(Okta exposes no evaluate-expression API — a true sandbox is high effort, Feature F).

Read the **result** of the rule, not a simulation of its expression: for a selected
rule, show its target group(s), live member counts, and — crucially — who would **lose**
access on a deactivate/edit (the scary case admins most need). No interpreter, no writes.

- Reuse: `getGroupRulesForGroup` (expression + groupIds already parsed),
  `getAllGroupMembers`, `compareGroups`-style set math, `ProgressContext`.
- UX: on a rule in RulesTab → "Preview impact" → panel with target groups, counts, and a
  paginated members list with a **before/after diff + loss highlighting**. This diff
  engine is exactly what A4 consumes.
- Done when: selecting a rule shows its captured population and the access delta of
  toggling it, read-only, tests green.

**Delivered** (branch `claude/high-impact-features`):

- Pure, reusable population-diff engine at `shared/membership/ruleImpact.ts`
  (`classifyGroupImpact` / `summarizeRuleImpact`) — I/O-free set math consistent with the
  app's single-source membership-attribution heuristic (`membershipAnalysis`): a member is
  attributed to a rule for a group when an ACTIVE rule targeting the group and not excluding
  them is that rule; they **lose** access only if no _other_ active, non-excluding rule also
  targets the group. `APP_GROUP` membership is application-managed and never attributed.
  This is exactly the diff **A4** will consume.
- Read-only capture op `useOktaApi/ruleImpact.ts::captureRuleImpact` — one rules listing +
  one member fetch per target group over the scheduler path; **no per-member calls**, so the
  "who loses access" answer needs no expensive user fan-out or uncertain internal endpoints.
- UX woven into the existing Rules tab (no new tab): each `RuleCard` gains a read-only
  **"Preview Impact"** action, and — closing a real safety gap — **deactivation is now gated**
  behind an impact-aware confirmation (`RuleImpactModal`) that leads with the loss headline
  before committing. State lives in the `useRuleImpact` hook.
- Honest framing in the UI: loss is inferred from rule targets + exclusions and manual adds
  can't always be distinguished — stated inline rather than over-claimed.

---

## C. `[ ]` Bulk Attribute Editor — safeguarded profile write

Mass-edit one profile field (department rename, title change) across many users, without
fighting externally-mastered (AD/HR) profiles.

- New endpoint: `POST /api/v1/users/{id}` (partial profile update — Okta merges);
  follow the `suspendUser` content-script pattern; zod-validate the response (ADR-0006).
- **Mastering detection (the differentiator):** skip users whose target attribute is
  externally mastered — check `profileMastered` / `credentials.provider`
  (`ACTIVE_DIRECTORY`, `IMPORT`) from `getUserById`. Skipped users are **listed with a
  reason**, never silently dropped.
- Reuse: `BulkTargetList` (paste/search → chips), bulk loop + `ProgressContext`, `Modal`
  confirm, `logAction` audit.
- UX flow: paste/search users → resolved chips → pick attribute (from a curated
  **allow-list**, no login/email footguns) + new value → **mandatory `PreflightSummary`**
  (N updatable / M skipped-locked + reasons, capturing old values) → confirm modal
  restating counts → run through scheduler with live progress → results summary
  (updated / skipped / failed) + CSV export + audit entry.
- _Enhancement:_ value **templating** (find-replace / derive-from-existing, e.g.
  normalize a title) in addition to a static value, with a per-user before→after table.
- _Safeguard:_ preflight captures prior values so undo can restore them.
- Done when: an admin can change one field across a resolved cohort, locked profiles are
  auto-skipped with reasons, the change is previewed/confirmed/audited/undoable, green.

---

## Parked / rejected (rationale recorded so we don't re-litigate)

- **D. Bulk Lifecycle Console** _(fast follow)_ — paste users → suspend/unsuspend/
  reactivate + trigger reset/activation emails. Extends existing lifecycle ops; the
  "comms engine" is just Okta's built-in `sendEmail` flag, framed honestly. Only new
  bits: `lifecycle/activate` + `reactivate`. Reuses `BulkTargetList` + preflight from C.
- **E. Group Push deploy** — the extension only **reads** push mappings
  (`getAppPushGroupMappings`); writing app group-push config is deep provisioning.
  High effort, parked.
- **F. OEL Sandbox (full)** — no Okta evaluate-expression API means building a custom EL
  interpreter. High effort; **Feature B is the affordable slice** that covers the common
  need (impact before toggling).
- **G. Policy Migrator** — **rejected.** The single-tab session model cannot address two
  tenants at once, and policy ops are entirely absent. Would require a different
  transport plus persisted cross-tenant credentials, violating the never-persist-tokens
  principle ([architecture.md](./architecture.md)).
