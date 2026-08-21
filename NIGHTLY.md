# Nightly log

Append-only. Newest entry first. One entry per session, whether or not it
shipped a PR.

Entry format:

```
## YYYY-MM-DD

**Baseline:** green | red — <what was red, if anything>
**Items worked:** <I-NNN/D-NNN list, or "none — baseline repair only">
**PR:** <link, or "none">
**Backlog after:** <open>/<total> items — <N> IMPROVEMENTS, <N> DEBT, <N> blocked
**Notes:** <anything the next run or Sam should know>
```

---

## 2026-08-21

**Baseline:** red — `npm run test:coverage` failed intermittently in a full-suite
run: `UsersTab.navigation.test.tsx > hides the profile body without unmounting
it, so its state survives` (passed every time run in isolation; failed
identically on 2 consecutive full-suite runs). Root cause: the tab-level user
search debounce was gated only on `isActive`, not on `nav.isRoot` — a query
typed just before navigating into a user's detail/comparison rung could still
commit after the push and clear `selectedUser`, unmounting both rungs. Fixed
by gating the debounce on `nav.isRoot && isActive`, mirroring the comparison
rung's own `searchEnabled` gate. Per `SESSION.md`, this repair was the whole
session — no backlog items were selected or implemented.

**Items worked:** baseline repair, plus `D-010` (filed _and_ closed tonight —
the pre-existing CI failure; picked up mid-session on Sam's instruction).
**PR:** https://github.com/samdhenderson/okta-unbound/pull/66
**Backlog after:** 14 open / 18 total — 8 IMPROVEMENTS (7 ux, 1
feature-completeness), 10 DEBT (6 correctness, 2 cleanup, 2 standards). 3
blocked (`I-008` needs-breakdown, `D-007` needs-breakdown, `D-008`
needs-human) — unchanged from the prior entry; `D-010` was filed tonight and
closed the same night as `done:#66`.
**Notes:** `test:coverage` is green on `main` again once PR #66 lands.
Separately — PR #66's GitHub Actions `verify` check came back red even
though the local ladder was green twice. Confirmed via GitHub's own run
history that `main`'s `verify` job had been failing identically on every
push since at least 2026-08-15 (4 commits), including on PR #66's own
unmodified base commit — pre-existing, not introduced by PR #66. Filed as
`D-010`, then (on Sam's instruction, mid-session) diagnosed and fixed it in
the same PR rather than leaving it for a later night.

The "only reproduces on GitHub" framing turned out to be wrong, and that
mattered: the failures don't depend on GitHub at all, only on the membership
fetch being slow. Injecting a delay into the `/users/{id}/groups` route
reproduces the same 5 failures locally and deterministically. Root cause was
a **wait that never waited** — `await findByText('Engineering')` resolved
against the user's `department` (the fixture uses `Engineering` for both the
department and the group name, and all three detail panes stay mounted per
ADR-0018), so it returned while zero `<h4>`s existed and the row lookup
raced the load. A probe pinned this exactly: matched node was a `SPAN` in a
`<dd>`, one `Engineering` node total, `queryAllByRole('heading', {level: 4})`
empty. The second symptom was a genuine production bug — two uncancelled
`setTimeout`s in `useRulesData.ts` firing `completeProgress()` after unmount.
**Lesson for future nights:** "passes locally, fails in CI" is a hypothesis,
not a diagnosis — find the variable CI actually changes (here: speed) and
reproduce on it locally before calling something environmental.

Re-verify the baseline is still green at the start of the next session before
picking up backlog items. The previous entry's recommended starting items
(`D-001`, `D-009`, `I-005`) are still the reasonable next pick — none of
tonight's diff touches their files.

---

## 2026-08-20 — system setup, not a work session

**Baseline:** green.

```
npm run type-check          # 0 errors
npm run lint                # 0 errors, 147 warnings (legacy debt, allowed)
npm run format:check        # clean
npm run test:coverage       # green — thresholds: lines 75 / fn 70 / branch 65 / stmt 75
npm run knip:circular       # 0 cycles
npm run lint:control-chars  # clean, 825 tracked files
npm run lint:cited-paths    # clean, 49 tracked docs/skill files
```

`npm run knip` / `knip:production` (advisory) show a modest backlog, mostly
barrel duplicate-exports on `export/descriptors/*` — not itemized in
`DEBT.md` tonight, low severity, re-triage if it grows. `test:storybook` and
`build` were not run tonight (browser/bundle cost) — both are hard CI gates
and belong in every future session that touches UI or entry points, per
`CONVENTIONS.md`.

**Items worked:** none — this session built the system itself
(`CONVENTIONS.md`, `IMPROVEMENTS.md`, `DEBT.md`, this file, `SESSION.md`,
the `.claude/agents/bugfix.md` agent, and the nightly rules section in
`CLAUDE.md`). No product code changed.

**PR:** none — setup lives on `setup/nightly-system` for Sam's review, not
merged.

**Backlog after:** 14 open / 17 total — 8 IMPROVEMENTS (7 ux, 1
feature-completeness), 9 DEBT (6 correctness, 2 cleanup, 1 standards).
3 blocked (`I-008` needs-breakdown, `D-007` needs-breakdown, `D-008`
needs-human) — none of the 14 open items are blocked.

**Notes for the first real night:** don't touch
`src/sidepanel/components/groups/detail/` beyond what `D-001`/`D-002`
require — Sam is about to start his own v2 of Group Detail and asked for it
left alone otherwise. Recommended starting items (P-order, disjoint files):
`D-001`, `D-009`, `I-005`. Full reasoning in the setup session's final report
to Sam, not repeated here — this log only tracks what actually ran.
