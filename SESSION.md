# Nightly session script

The sequence for one unattended run. This file owns _only_ the order of
operations — the durable rules it must not violate live in `CLAUDE.md`
("Nightly maintenance system"); the technical standards each step verifies
against live in `CONVENTIONS.md`; the work items live in `IMPROVEMENTS.md`
and `DEBT.md`.

## Agent roster and what each item type routes to

| Item shape                                                                                        | Agent                                               | Notes                                                                                                                               |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| UI-shaped `IMPROVEMENTS.md` item (new/changed component, badge, layout, scroll wiring, tab order) | `component-builder`                                 | Delegates its own tests to `test-writer` when needed                                                                                |
| `DEBT.md` item, category `correctness`, fix changes behavior                                      | `bugfix`                                            | The only writer allowed to change observable behavior on purpose                                                                    |
| `DEBT.md` item, category `cleanup`/`standards`, no behavior change (dedupe, extraction)           | `architecture-refactor`                             | Behavior-preserving only — wrong tool for anything in the row above                                                                 |
| `DEBT.md` item that's pure missing test coverage                                                  | `test-writer`                                       | Called directly, not via another writer                                                                                             |
| `blocked:needs-breakdown` item flagged architecturally significant                                | general-purpose agent, **read-only, proposal-only** | Output is prose appended to the item, or a new doc under `docs/` — never a diff. Matches the plan-and-approval gate in `CLAUDE.md`. |
| Any diff touching messaging, manifest, storage, exports, logging, or Okta-response handling       | `security-logging-reviewer` (after the writer)      | Read-only review, runs before the item is included in the PR                                                                        |
| Any diff under `src/sidepanel/components/**`                                                      | `ui-reviewer` (after the writer)                    | Read-only review, same timing                                                                                                       |
| A convention/ADR now stale because of what shipped                                                | `docs-maintainer`                                   | Runs last, only if triggered                                                                                                        |

## Sequence

**1. Verify baseline.** Run `CONVENTIONS.md`'s verification ladder against
`main` as it stands. If anything is red, **that repair is the entire
session**: fix it directly on a `nightly/YYYY-MM-DD` branch, one commit,
verify green, open the PR, update `NIGHTLY.md`, stop. Do not select or
implement backlog items alongside a red baseline.

**2. Select 2–3 open items.** From `IMPROVEMENTS.md` + `DEBT.md`, filter to
`Status: open` (never `blocked:*`, `claimed:*`, or `done:*`). Sort by
Priority (P0 → P3); within a tie, prefer an `IMPROVEMENTS.md`/`ux` item over
a `DEBT.md` item ("UX first"); within a further tie, prefer files untouched
by the last 3 `nightly/*` branches (`git log --name-only` across recent
`nightly/*` branches). Pick the top 2–3 whose **Files** lists don't overlap
with each other — skip down the sorted list rather than picking two items
that would touch the same file. Skip anything whose files fall under
`src/sidepanel/components/groups/detail/` unless the item itself is scoped
there and explicitly permitted (`CLAUDE.md`'s off-limits rule). Mark each
selected item `claimed:nightly/YYYY-MM-DD` — this edit lands in the PR's
diff (see step 6), not as a separate push to `main`; a claimed item isn't
real until the PR carrying it exists.

**3. Branch.** Create `nightly/YYYY-MM-DD` off `main`.

**4. Implement each item — one commit per item.** Route each to its agent
per the roster above. An item's agent may only touch what that item's
**Files** and **Done when** specify; new work noticed in passing gets filed
as a fresh backlog item, never folded in (`CLAUDE.md`). Items with
genuinely disjoint files may run in parallel (their writer agents don't
share state); anything else serializes. **Commit an item only once every
writer agent has finished** — never as one reports while another is still
working. The pre-commit hook stashes the whole working tree's unstaged
changes for the length of its run, so committing item A takes item B's
in-flight edits off disk while B is still using them (`CONVENTIONS.md`,
`D-023`). After each item's commit, run
`CONVENTIONS.md`'s ladder scoped to what changed — always type-check/lint/
format/test:coverage; add `test:storybook` if UI files changed; add `build`
if `manifest.json`/`vite.config.ts`/`src/background/**`/`src/content/**`
changed. If an item can't go green without expanding past its own scope,
don't ship a red commit — mark it `blocked:<reason>` in the ledger instead
and pull the next disjoint candidate from the sorted list to fill the slot.

**5. Review the combined diff.** Run `ui-reviewer` and/or
`security-logging-reviewer` (read-only, parallel with each other) per the
roster's trigger conditions, against the branch's full diff. Fix anything
that violates a `CLAUDE.md` hard rule by amending the relevant item's own
commit (not a new "review fixup" commit — keep one-commit-per-item true).
Note anything advisory-but-unfixed in the PR description rather than
silently dropping it.

**6. Re-verify, update ledgers, open one PR.** Run the full ladder once more
against the branch. Update `IMPROVEMENTS.md`/`DEBT.md`: shipped items become
`done:<PR#>` (fill in after `gh pr create` returns a number, then push a
final small commit to the same branch), anything demoted to `blocked` stays
that way with its reason. Append tonight's `NIGHTLY.md` entry. Open one
combined PR against `main` (`gh pr create`) with a title/body in the
project's existing commit style — squash-merged history means the PR
description is what survives, so name every item closed and any behavior
change explicitly, per `CLAUDE.md`'s silent-behavior-change kill switch.
**Never merge it** — a human decision, always.

**7. Stop.** Nothing after the PR is open. No further edits, no retry loop.

## What this file deliberately does not restate

Never merge / no dependency or `manifest.json` changes / the red-baseline
rule / file caps / the Group Detail off-limits window / where new items get
filed — all in `CLAUDE.md`, not here, so there's exactly one place to check
or change them. Verification commands and technical standards — all in
`CONVENTIONS.md`. If this file and either of those disagree, they win; file
a correction here.
