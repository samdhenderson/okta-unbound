# Nightly session script

The sequence for one unattended run. This file owns _only_ the order of
operations — the durable rules it must not violate live in `CLAUDE.md`
("Nightly maintenance system"); the technical standards each step verifies
against live in `CONVENTIONS.md`; the work items live in `IMPROVEMENTS.md`
and `DEBT.md`.

## Agent roster and what each item type routes to

| Item shape                                                                                        | Agent                                               | Notes                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI-shaped `IMPROVEMENTS.md` item (new/changed component, badge, layout, scroll wiring, tab order) | `component-builder`                                 | Delegates its own tests to `test-writer` when needed                                                                                                    |
| `DEBT.md` item, category `correctness`, fix changes behavior                                      | `bugfix`                                            | The only writer allowed to change observable behavior on purpose                                                                                        |
| `DEBT.md` item, category `cleanup`/`standards`, no behavior change (dedupe, extraction)           | `architecture-refactor`                             | Behavior-preserving only — wrong tool for anything in the row above                                                                                     |
| `DEBT.md` item that's pure missing test coverage                                                  | `test-writer`                                       | Called directly, not via another writer                                                                                                                 |
| `research:awaiting-review` item (architecturally significant, scoped as an ADR)                   | general-purpose agent, **read-only, proposal-only** | Output is a Proposed-status ADR under `docs/adr/`. The PR touches `docs/` only — zero files under `src/`. Sam moves the item to `open` by accepting it. |
| Any diff touching messaging, manifest, storage, exports, logging, or Okta-response handling       | `security-logging-reviewer` (after the writer)      | Read-only review, runs before the item is included in the PR                                                                                            |
| Any diff under `src/sidepanel/components/**`                                                      | `ui-reviewer` (after the writer)                    | Read-only review, same timing                                                                                                                           |
| A convention/ADR now stale because of what shipped                                                | `docs-maintainer`                                   | Runs last, only if triggered                                                                                                                            |

## Sequence

**1. Verify baseline.** Run `CONVENTIONS.md`'s verification ladder against
`main` as it stands. If anything is red, **that repair is the entire
session**: fix it directly on a `nightly/YYYY-MM-DD` branch, one commit,
verify green, open the PR, update `NIGHTLY.md`, stop. Do not select or
implement backlog items alongside a red baseline.

**2. Survey the open PRs — before reading the backlog.** Run:

```
gh pr list --state open --json number,title,headRefName,body
gh pr view <N> --json files --jq '.files[].path'   # for each one
```

**An item is marked `claimed:` inside the PR that implements it, never on
`main`.** So the ledger on `main` still reads `open` for everything an
unmerged night already did, and a session that trusts it will redo that work
— which is exactly what has been happening. Collect every `I-NNN`/`D-NNN`
mentioned in any open PR's title or body and treat those items as claimed for
tonight, whatever the ledger says. Note the list in tonight's `NIGHTLY.md`
entry so the next session can see what was excluded and why.

**Then collect every open PR's changed files, and treat them as contended.**
Item ids alone are not enough, and the first run of this step proved it: on
2026-08-24 the three open PRs were `feat/*` and `refactor/*` branches naming
no backlog item at all, yet one was already editing inside
`groups/detail/` and another was editing `useGroupSource.ts`, a downstream
consumer of the module `D-029d` exists to delete. **Skip any item whose
**Files** list names a file changed in an open PR**, whoever opened it —
Sam's own branches count. This is the same disjointness test step 3 already
applies within a night, extended to the work that is in flight outside it.

**Three hard stops:**

- **Three or more open PRs from unattended runs → stop the session.** Append
  a `NIGHTLY.md` entry recording the count and the PR numbers, and open
  nothing. Backlog is being produced faster than it is reviewed; a fourth PR
  makes the queue worse, not the code better. Count branches an unattended
  run would have created (`nightly/*`, and whatever the harness assigns in
  its place); a human's feature branch contends for files but does not count
  toward this cap.
- **An open PR whose branch is the one you were about to create → stop.**
  Never push onto or reopen a previous night's branch.
- **No candidate survives the contention filter → stop.** Say so in
  `NIGHTLY.md` and open nothing. An item picked anyway will conflict on
  merge, and resolving that conflict is a human's call about someone else's
  in-flight work.

If `gh` is unavailable or unauthenticated in the session's environment, that
is itself a stop: without it there is no way to tell in-flight work from open
work, and guessing is how duplicates get made. Record the failure and stop.

**3. Select 2–3 open items.** From `IMPROVEMENTS.md` + `DEBT.md`, filter to
`Status: open` (never `blocked:*`, `research:*`, `claimed:*`, `closed:*`, or
`done:*`), then drop anything claimed by an open PR per step 2.

**Re-verify before claiming.** Every item carries a `Verified:` date. If a
candidate's is more than 14 days old, re-check its **Problem** with the
`okta-claim-check` skill — enumerate importers and call sites, do not sample
or trust a grep for mentions. If the Problem no longer holds, close it
`closed:refuted-<date>` (or `closed:overtaken-by-<sha>`) with the finding and
pull the next candidate; that closure **is** a night's work and belongs in
the PR. Three of five gated items were found stale this way on 2026-08-24. Sort by
Priority (P0 → P3); within a tie, prefer an `IMPROVEMENTS.md`/`ux` item over
a `DEBT.md` item ("UX first"); within a further tie, prefer files untouched
by the last 3 `nightly/*` branches (`git log --name-only` across recent
`nightly/*` branches). Pick the top 2–3 whose **Files** lists don't overlap
with each other — skip down the sorted list rather than picking two items
that would touch the same file. Mark each
selected item `claimed:nightly/YYYY-MM-DD` — this edit lands in the PR's
diff (see step 7), not as a separate push to `main`; a claimed item isn't
real until the PR carrying it exists — which is precisely why step 2 reads
the PRs and not just the ledger.

**4. Branch.** Create `nightly/YYYY-MM-DD` off `main`.

**5. Implement each item — one commit per item.** Route each to its agent
per the roster above. An item's agent may only touch what that item's
**Files** and **Done when** specify; new work noticed in passing gets filed
as a fresh backlog item, never folded in (`CLAUDE.md`). Items with
genuinely disjoint files may run in parallel (their writer agents don't
share state); anything else serializes. **Commit an item only once every
writer agent has finished** — never as one reports while another is still
working. When a pre-commit task fails, the hook runs `git reset --hard HEAD`
and restores a snapshot taken before the commit started, which destroys any
edit a live writer made in between — silently (`CONVENTIONS.md`, `D-023`).
After each item's commit, run
`CONVENTIONS.md`'s ladder scoped to what changed — always type-check/lint/
format/test:coverage; add `test:storybook` if UI files changed; add `build`
if `manifest.json`/`vite.config.ts`/`src/background/**`/`src/content/**`
changed. If an item can't go green without expanding past its own scope,
don't ship a red commit — mark it `blocked:<reason>` in the ledger instead
and pull the next disjoint candidate from the sorted list to fill the slot.

**6. Review the combined diff.** Run `ui-reviewer` and/or
`security-logging-reviewer` (read-only, parallel with each other) per the
roster's trigger conditions, against the branch's full diff. Fix anything
that violates a `CLAUDE.md` hard rule by amending the relevant item's own
commit (not a new "review fixup" commit — keep one-commit-per-item true).
Note anything advisory-but-unfixed in the PR description rather than
silently dropping it.

**7. Re-verify, update ledgers, open one PR.** Run the full ladder once more
against the branch. Update `IMPROVEMENTS.md`/`DEBT.md`: shipped items become
`done:<PR#>` (fill in after `gh pr create` returns a number, then push a
final small commit to the same branch), anything demoted to `blocked` stays
that way with its reason. Append tonight's `NIGHTLY.md` entry. Open one
combined PR against `main` (`gh pr create`). **Every item the PR touches must
appear as a bare `I-NNN`/`D-NNN` token in the title or body** — that string
is what the next session's step 2 greps for, so an item described only in
prose ("the audit attribution fix") is invisible to it and gets picked up
again. Write the title/body in the project's existing commit style —
squash-merged history means the PR description is what survives, so name
every item closed and any behavior
change explicitly, per `CLAUDE.md`'s silent-behavior-change kill switch.
**Never merge it** — a human decision, always.

**8. Stop.** Nothing after the PR is open. No further edits, no retry loop.

## What this file deliberately does not restate

Never merge / no dependency or `manifest.json` changes / the red-baseline
rule / file caps / the three-open-PRs stop / what `research:awaiting-review`
permits / where new items get filed — all in `CLAUDE.md`, not here, so there's exactly one place to check
or change them. Verification commands and technical standards — all in
`CONVENTIONS.md`. If this file and either of those disagree, they win; file
a correction here.
