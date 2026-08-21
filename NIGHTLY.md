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

## 2026-08-21 (fourth run)

**Baseline:** red — the `storybook` CI job on `main` @ `ceddca8`. Every other
gate was clean locally (type-check 0 errors, lint 0 errors / 147 warnings,
format clean, 209 test files / 2962 tests passed with thresholds met, 0
cycles, control-chars clean over 835 files, cited-paths clean over 50). The
red one was `D-017`, and it was caught **by running `test:storybook` at
baseline** rather than by claiming the item by name as the filing suggested
would be necessary — GitHub's own run history for `main` confirmed `storybook`
failing on `808ab30` and `ceddca8` while `verify` passed on both.

Per `SESSION.md` step 1 this repair was the entire session. **No backlog items
were selected or implemented alongside it.** For the record, had the baseline
been green the sort would have opened `D-017` (P1) → `I-003` (P2, ux; `I-002`
still skipped, its files are under the off-limits `groups/detail/`) → `D-003`
(P2) — three disjoint **Files** lists. That is the next run's starting pick.

**Items worked:** `D-017` — baseline repair only.

**PR:** https://github.com/samdhenderson/okta-unbound/pull/69

**Backlog after:** 13 open / 26 total — 9 IMPROVEMENTS (6 open, 1 blocked, 2
done), 17 DEBT (7 open, 3 blocked, 7 done). 4 blocked, unchanged (`I-008`
needs-breakdown, `D-007` needs-breakdown, `D-008` needs-human, `D-013`
needs-human). 1 closed tonight as `done:#69`. Nothing new filed.

**Notes:**

`ActionBar.stories.tsx` is the **first** file the story run processes, not the
last — the filing had it backwards, and it matters. Vitest orders test files
largest-first and ActionBar is the biggest story file in the tree; the local
run's completion order puts it at 1 of 149. So the file that dies is simply
whatever is in flight when the dep optimizer reloads the page at startup, which
is what makes a file that imports neither `react-dom` nor `Modal` the standing
victim of a `react-dom` import added to `Modal.tsx` in #68. `D-017`'s named
fallback hypothesis ("the run's tail behaviour") is therefore the wrong place
to look if this fix does not take.

**The fix is unprovable locally and was not proven locally.** The suite passes
here with and without it — 149 files / 1042 tests green both ways, run on the
branch before and after the change. That is the second time in four nights
(`D-010` was the first) that the honest answer was "the variable is the
runner." Both times the temptation was to call the gate environmental. It was
not, either time.

`test:storybook` is now an **unconditional** baseline gate in `CONVENTIONS.md`,
with the `VITEST_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
pin it needs in this sandbox. It was previously listed as conditional on what
the diff touched, and three consecutive sessions skipped it — which is how a red
gate sat on `main` across two nights. The full-suite storybook run costs roughly
2 minutes here, and `build-storybook` about 40 seconds; neither is expensive
enough to justify the conditional.

Still true from the last entry, and it bit again: `pkill -9 -f vitest` matches
the shell running it, so a command that runs vitest and then pkills in the same
line kills itself. Keep them in separate invocations.

**Deviation from `SESSION.md`, for the record:** this session's branch is
`claude/stoic-gates-3izrje`, not `nightly/2026-08-21`. The harness that starts
these runs pins the branch name and forbids pushing anywhere else; the branch
name is the only part of the sequence that differs.

**Still unfiled, carried forward from the last entry** (it needs a look before
it is worth an item number): `UserAppsList` (`UserDetailPanel.tsx:237`) takes
the same `memberships` array as the Groups pane but gates on `isLoadingApps`
rather than `isLoadingMemberships`, so it may render membership-derived content
mid-load.

---

## 2026-08-21 (third run)

**Baseline:** green — full `CONVENTIONS.md` ladder clean on `main` @ `9ea42a3`
(type-check 0 errors, lint 0 errors / 147 warnings, format clean, 207 test
files passed with coverage thresholds met, 0 cycles, control-chars and
cited-paths clean).

**Items worked:** `D-009`, `I-005`, `I-001` — the top of the sorted list with
disjoint **Files** (P1 first, then P2 with UX ahead of debt). `I-002` was
skipped despite sorting above `I-005`: its files are under
`src/sidepanel/components/groups/detail/`, still off-limits. `I-003` sorts in
the same tie as `I-005` on every key `SESSION.md` defines; `I-005` was taken
because `I-003` carries `Depends on: I-001` and shipping a dependent item in
the same PR would mean one review objection invalidating two commits.

**PR:** https://github.com/samdhenderson/okta-unbound/pull/68

**Backlog after:** 13 open / 25 total — 9 IMPROVEMENTS (6 open, 1 blocked,
2 done), 16 DEBT (7 open, 3 blocked, 6 done). 4 blocked (`I-008`
needs-breakdown, `D-007` needs-breakdown, `D-008` needs-human, `D-013`
needs-human). 3 closed tonight as `done:#68`; 3 new items filed from the
review (`D-015`, `D-016`, `I-009`).

**Notes:**

**The browser story suite does run in this sandbox — future sessions should
run it.** Both writer agents reported `test:storybook` as impossible
("Playwright's browser binary is absent"), and the previous two sessions
skipped it as well. It is not absent: Chromium is pre-installed at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, and `vitest.config.ts`
already has the seam for it —
`VITEST_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:storybook`
runs the full suite (149 story files, 0 failures tonight). `npx playwright
install` is the thing that fails, and reaching for it is what made this look
unavailable. Set the env var instead; a hard CI gate should not be taken on
faith three nights running.

**`pkill -9 -f vitest` kills more than its own run.** `CONVENTIONS.md`'s test
recipe ends with `pkill -9 -f vitest` "regardless of outcome". With a writer
agent working while the session runs its own ladder, that pattern matches the
_other_ run too — three full `test:coverage` runs died at `SIGKILL` mid-suite
before the cause was clear, and the pattern also matches the invoking shell's
own command line. Worth narrowing the recipe (a PID-scoped kill, or dropping
it now that the `perl alarm` wrapper already bounds the run); filed here as a
note rather than as a backlog item because it is a change to `CONVENTIONS.md`
itself.

**Branch name deviated again, same reason as the second run.** `SESSION.md`
step 3 says `nightly/YYYY-MM-DD`; the execution environment pins this session
to `claude/stoic-gates-apffyc` and forbids pushing anywhere else, so the
`claimed:` markers named that branch. This is now two of three runs — worth
either amending `SESSION.md` or fixing the launcher, rather than logging the
same deviation every night.

**D-014 is not actually pickable.** It sorts as an open P3, but its own body
says "sequence it after `D-013`", and `D-013` is `blocked:needs-human`. A
future run following the sort mechanically will pick it up and then have to
put it back down; consider marking it `blocked:needs-D-013`.

**Recommended next pick** (P-order, disjoint files, none under
`groups/detail/`): `D-016` (P2, small, closes the coverage gap this PR
opened), then `D-003` (P2, one-line logging fix in `pushGroupOps.ts`), then
`I-003` — now unblocked, since `I-001` shipped tonight.

---

## 2026-08-21 (second run)

**Baseline:** green — full `CONVENTIONS.md` ladder clean on `main` @ `25f5e45`,
and CI's `verify` job green there too, for the first time since 2026-08-15.
D-010's fix landing with #66 did what it claimed.

**Items worked:** `D-002`, `D-001`, `D-004` as planned, plus `D-011` — filed
and closed the same night because it blocked the commit path (see below).
`D-012`, `D-013`, `D-014` filed, not worked.

**PR:** https://github.com/samdhenderson/okta-unbound/pull/67

**Backlog after:** 13 open / 21 total — 8 IMPROVEMENTS (7 ux, 1
feature-completeness), 13 DEBT. 4 blocked (`I-008` needs-breakdown, `D-007`
needs-breakdown, `D-008` needs-human, `D-013` needs-human). 4 closed tonight
as `done:#67`.

**Notes:**

**Branch name deviated, and it matters for next time.** `SESSION.md` step 3
says `nightly/YYYY-MM-DD`; this run was launched into an environment that
pins its own push target and forbids pushing elsewhere, so the work is on
`claude/stoic-gates-v1ccfh`. Consequences: the ledger's `claimed:` values
named that branch, and step 2's "prefer files untouched by the last 3
`nightly/*` branches" tie-break will not see this branch. Either reconcile
`SESSION.md` with how these runs actually get launched, or widen that
tie-break's branch glob.

**Selection deviated once, deliberately.** The P1 tier was `D-001`, `D-004`,
`D-009`. `D-002` is P3, but `D-001`'s own ledger entry says to do it "before
or alongside" so `D-001` reuses the shared helper instead of adding a fourth
copy — so it was treated as part of `D-001`'s path rather than as a
priority-order jump. `D-009` (modals under `ActivityBar`) was passed over:
its "Done when" asks for a _structural_ fix across ~15 call sites and names
two viable approaches, which is exactly the plan-and-approval gate's "would a
reviewer disagree with the approach after the code exists?". It stays open
and wants a decision from Sam before a night takes it, or it will keep being
the P1 nobody picks up.

**The night's real lesson: the ladder is not the commit path.** `SESSION.md`
step 1 verifies `CONVENTIONS.md`'s ladder. That passed. What did not pass was
the pre-commit hook — `lint-staged` runs `vitest related --run --project unit`
over _staged_ files, which pulled in `App.tabpersistence.test.tsx` as related
to an unrelated staged change and went red on a clean tree. So a green
baseline by step 1's definition can still be a repo where nothing can be
committed. Consider adding a staged-commit smoke check to step 1, or noting
in `CONVENTIONS.md` that `vitest related` selects a set the ladder never runs
in isolation.

**And the same lesson as last night, from the other end.** Last night: "passes
locally, fails in CI" was speed, not environment. Tonight: "passes in the
suite, fails alone" was _also_ speed — a lazy tab chunk's `import()` against
Testing Library's 1s default `findBy*` budget, cheap only because some earlier
file in a full-suite run had already warmed it. Both times the variable was
how long a load took and both times the fix was to give a wait the budget it
always meant. Worth treating "green here, red there" as a timing question by
default.

**`test:storybook` is runnable in this sandbox** — prior sessions recorded it
as blocked on missing Playwright browsers. It needs
`VITEST_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`;
the default resolution looks for a build that is not installed. 149 story
files pass. If the sandbox is stable this belongs in `CONVENTIONS.md`, since
two agents tonight independently concluded the gate could not be run.

**Also worth knowing:** `pkill -9 -f vitest` (which `CONVENTIONS.md` mandates
after a local run) matches any shell whose own command line contains the
string — so a loop that runs vitest and then pkills it kills itself. It ate
several runs tonight before I spotted it, and a subagent independently lost
three full-suite runs to another agent's pkill. Run one vitest invocation per
shell command, and keep concurrent agents off it.

**Unfiled observation for Sam:** `UserAppsList` (`UserDetailPanel.tsx:237`)
takes the same `memberships` array as the Groups pane but gates on
`isLoadingApps` rather than `isLoadingMemberships`, so it may render
membership-derived content mid-load. Noticed while wiring `D-001`, not
investigated, not filed — it needs a look before it is worth an item number.

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
