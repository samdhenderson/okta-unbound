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
