# Features plan (living)

Start here to scope or pick up **new feature** work (as opposed to maintainability
work, whose 2026-07 overhaul is complete — see `CLAUDE.md` and `docs/adr/`). This is
a living catalog: add ideas, check items off, record why something was parked so it
isn't re-litigated.

The single fact that reshapes everything: **the write surface is narrow and the session
is single-tenant**. Today the app can `suspend`/`unsuspend` users,
`resetPassword(sendEmail=true)`, add/remove group members, run bulk group ops,
`activate`/`deactivate` rules, and — since Feature A4 — **create / delete group rules**
(zod-validated, via the safe create → activate → retire sequence). It still has **no**
profile write, no user `activate`/`reactivate`, no in-place rule edit, no app-push
writes, and no policy ops. Every API call targets one browser tab's Okta session — two
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
| Rule read + write                       | `getGroupRulesForGroup`; `ruleWrites` (create/delete/(de)activate) | `groupDiscovery.ts`, `hooks/useOktaApi/ruleWrites.ts`        |
| Population diff (who gains/loses)       | `classifyGroupImpact`, `summarizeRuleImpact`                       | `shared/membership/ruleImpact.ts`                            |

The two primitives worth building **once** and reusing across C/D:

- **`BulkTargetList`** — paste/CSV or search → resolve via `searchUsers`/`getUserById`
  → removable chips, unresolved entries flagged. Add **saved named lists** (persist in
  `idb`) so an admin can reuse "Q3 offboarding cohort" across sessions.
- **`PreflightSummary`** — "N will change · M skipped · why", shown before any write.
  Nothing mutates until the admin has seen it. This is the biggest trust win.

---

## Catalog (ranked by impact ÷ effort)

| Feature                                | Effort | Impact   | Verdict                        |
| -------------------------------------- | ------ | -------- | ------------------------------ |
| A. Orphan/Clutter + Rule Consolidation | M      | High     | `[x]` **Shipped (flagship)**   |
| B. Rule Impact Preview                 | L–M    | High     | `[x]` **Shipped**              |
| C. Bulk Attribute Editor               | M      | High     | `[ ]` **Build (next)**         |
| D. Bulk Lifecycle Console              | M      | Med–High | Fast follow                    |
| E. Group Push deploy                   | H      | Med      | Parked                         |
| F. OEL Sandbox (full)                  | H      | Med      | Parked (B is the cheap slice)  |
| G. Policy Migrator                     | XL     | Med      | Rejected (single-tenant block) |

---

## Shipped (A + B)

**A. Orphan / Clutter Remediation + Rule Consolidation — flagship** `[x]`
All four sub-features landed; the _why_ is captured in the code and ADRs.

- **A1 — Cleanup triage** (`groups/clutterAnalysis.ts::analyzeClutter`): a pure, tested
  classifier over the loaded `GroupSummary[]` fuses empty / duplicate-name / stale /
  missing-description into one 0–100 review score. Surfaced as a **Cleanup** panel inside
  the Groups tab whose category counts are one-click selectors into the existing
  selection → bulk/export machinery — no new mutation surface.
- **A2 — Membership-source insight** (`GroupSourceModal` + `useGroupSource` +
  `shared/membership/groupSource.ts`): per-group "why does this exist / who feeds it" —
  feeding rules, app-push targets, and a gated manual-vs-rule split. Read-only.
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

## C. `[ ]` Bulk Attribute Editor — safeguarded profile write (next build)

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
- _Enhancement:_ value **templating** (find-replace / derive-from-existing) with a
  per-user before→after table.
- _Safeguard:_ preflight captures prior values so undo can restore them.
- Done when: an admin can change one field across a resolved cohort, locked profiles are
  auto-skipped with reasons, the change is previewed/confirmed/audited/undoable, green.

---

## Known tech debt / follow-ups

Carried forward from the A/B build (surfaced while working, none blocking):

- **A4 hardening (highest risk).** The rule create/delete path is the sharpest code in
  the repo and hasn't been exercised against a live tenant. Add a `useRuleConsolidation`
  hook test (mock the write ops) pinning the create → activate → retire sequencing and
  the abort-before-delete guarantee; consider a post-create verification read.
- **A3/A4 audit attribution.** Both write a placeholder `performedBy:
'unknown@unknown.com'` (they don't fetch `/users/me` like the rule lifecycle does).
  Thread the current user through for accurate audit trails.
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

---

## Parked / rejected (rationale recorded so we don't re-litigate)

- **D. Bulk Lifecycle Console** _(fast follow)_ — paste users → suspend/unsuspend/
  reactivate + trigger reset/activation emails. Extends existing lifecycle ops; the
  "comms engine" is just Okta's built-in `sendEmail` flag. Only new bits:
  `lifecycle/activate` + `reactivate`. Reuses `BulkTargetList` + preflight from C.
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
