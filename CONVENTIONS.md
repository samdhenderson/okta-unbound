# Conventions nightly runs enforce

This is the standards layer for the unattended maintenance system (see
`SESSION.md` for the sequence, `IMPROVEMENTS.md`/`DEBT.md` for the backlog,
`NIGHTLY.md` for the log). Everything here is derived from what the codebase
already does — where it was inconsistent, one pattern is picked below and the
divergence is filed as debt, not silently normalized.

`CLAUDE.md` still owns the durable cross-cutting rules (never merge, file
caps, off-limits areas). This doc owns the technical standards a nightly
agent needs to match the existing house style.

## DOM injection rules

`src/content/pageContext.ts` is the reference pattern for scraping the Okta
admin page DOM — **every new selector-based extraction must follow it**:

```ts
const selectors = ['h1[data-se="group-name"]', '.group-profile-header h1' /* … */];
for (const selector of selectors) {
  const element = document.querySelector(selector);
  if (element) return element.textContent?.trim() || null;
}
return null;
```

A prioritized selector list, tried in order, returning `null` on total miss.
**Never throw on a missing selector** — Okta's admin DOM changes without
notice across orgs/versions; a thrown error there breaks the whole content
script, a `null` degrades one field. This is already consistent across all 4
call sites in `pageContext.ts`; keep it that way.

## SPA route-change handling

**Decision:** there is no persistent route-change listener (no
`MutationObserver`, no `popstate`/`pushstate` hook) in the content script,
and that's deliberate, not a gap. Page context (current group/user/app/policy)
is derived fresh from `window.location.href` + the DOM **at the moment a
message handler runs** (`handleGetGroupInfo`, `handleGetUserInfo`, etc. in
`src/content/index.ts`), not cached against a watched route. A nightly run
should not "fix" this by adding a watcher — it would add persistent listener
state to a context that currently has none, and none of the four extraction
functions need staleness protection they don't already have.

## Messaging conventions

- **All raw Okta API traffic goes through the scheduler path**: side panel →
  `makeApiRequest` (`useOktaApi/core.ts`) → background `ApiScheduler` →
  content script `apiRequest.ts` (the only file that calls `fetch(` against
  Okta — verified, zero other hits in `src/`). Never add a side-panel→content
  call that fetches Okta directly.
- Direct `sendMessage` to the content script is legitimate **only** for
  non-API page-context reads (`getGroupInfo`, `getUserInfo`, `getOktaOrigin`,
  etc.) — it carries no Okta API traffic and doesn't touch the scheduler.
- Every message listener (background **and** content script) validates
  `sender.id !== chrome.runtime.id` and rejects foreign senders before doing
  anything else. Background additionally rejects any scheduler/tab-state
  action whose `sender.tab` is set (`rejectIfFromTab`) — those actions are
  extension-page-only by design.
- `scheduleApiRequest` validates endpoint (`startsWith('/')`, not `//`),
  method (allow-list), priority (allow-list), and `tabId` (integer) before
  it ever reaches the scheduler. Any new message action needs the same
  shape: validate sender, then validate structure against a closed
  allow-list — never a path allow-list (deliberate, per `CLAUDE.md`).

## Okta API throttling

`ApiScheduler` (`shared/scheduler/apiScheduler.ts`) owns throttling:
concurrency cap of 5, a priority queue (`interactive > high > normal > low`),
`RateLimitDetector` parsing `X-Rate-Limit-*` response headers, cooldowns
when remaining capacity drops below 10%, and exponential backoff with up to
3 retries. Any new bulk/multi-call operation goes through
`coreApi.runOperation` (`shared/scheduler/runBatch.ts`), never a hand-rolled
`for await` / `Promise.all` loop — that's the existing, already-consistent
pattern.

## Session-expiry handling

**There is now one predicate that decides a session is gone, and only one.**
`isSessionExpired(result)` (`src/shared/scheduler/requestResult.ts`) matches
**401 only** — deliberately not 403 (a permission the admin genuinely lacks;
re-authenticating is a dead end), not 429 (a live session being throttled), and
not the module's `NO_HTTP_STATUS` sentinel, which means nothing is known about
the session. It can be trusted because `RequestResult`
(`src/shared/scheduler/types.ts`) is a discriminated union whose failure arm
carries a **non-optional** `status`, and `ApiScheduler.makeApiCall`
(`src/shared/scheduler/apiScheduler.ts`) pipes every content-script reply
through `normalizeRequestResult`, so that promise holds at runtime and not
only in the type. Failures that never produced an HTTP response — a transport
throw, a boundary-guard rejection in `src/content/apiRequest.ts` — carry
`NO_HTTP_STATUS` (`0`) instead of omitting the field. It is falsy: compare it
with `===`, never for truthiness. (`D-007a`)

The old instruction still stands in spirit — don't improvise session handling
inline, in whatever file a nightly run happens to be touching. What changed is
that there is now something to call instead of improvising: use
`isSessionExpired`, never a hand-rolled `status === 401` or a one-off
try/catch.

Two things remain unsolved, so don't read the predicate as the whole fix:

- **Exactly one surface distinguishes an expired session.** `getAppById`
  (`src/sidepanel/hooks/useOktaApi/appOperations.ts`) returns an `AppLookup`
  of `found | missing | session-expired | failed{status}`, and HomeTab's jump
  bar is its only consumer. There is **no app-wide session-expiry UX**:
  everywhere else, an expired session still surfaces as an ordinary
  failed-request error state. That is `D-007b`, and it is gated on an accepted
  ADR before any `src/` change.
- **Retry behavior is unchanged.** `makeApiCall` still _resolves_ a failure
  rather than throwing, so a 429 takes the success path in `executeRequest` and
  is never routed into `retryRequest` — backoff still covers transport throws
  and timeouts only. That is `D-007c`'s job, not a side-effect to fold into
  unrelated work.

## Test expectations

- Mock at the `useOktaApi` facade or a fake `CoreApi`, never MSW (not used in
  this repo — the side panel never calls `fetch` directly).
- Coverage thresholds (enforced in CI via `test:coverage`, source of truth
  is `vitest.config.ts`): lines 75 / functions 70 / branches 65 / statements 75. Never lower a threshold to pass — that needs an ADR.
- Never weaken an assertion or delete a case to silence a failure (ADR-0012).
  Removing a test is only legitimate under the four ADR-0022 carve-outs, and
  needs a PR note saying what stays covered.
- A new regression test must be proven non-vacuous: revert the fix, confirm
  the test goes red, restore the fix, confirm green.
- Wrap every local `vitest run` invocation with an external timeout — a
  render loop starves `--testTimeout`'s own clock:
  `perl -e 'alarm 240; exec @ARGV' npx vitest run <file>`.
- If a runner survives the wrapper, reap it with
  `pkill -9 -f '^[^ ]*node[^ ]* .*vitest'`, and make that `pkill` **its own
  final command** — never chain it ahead of anything that still needs to run
  (a commit, the `git checkout --` that restores a mutated file, the next
  run). `pkill -f` matches the full command line of every process, so the
  old bare `-f vitest` pattern also SIGKILLed the shell that invoked it, and
  everything sequenced after it silently vanished behind a bare non-zero
  exit. The `^[^ ]*node[^ ]* ` anchor matches only a process whose command
  line _starts_ with a node binary, which a shell never does. It does still
  match every vitest runner on the machine, including another agent's — when
  writers run in parallel, `pgrep -a -f '^[^ ]*node[^ ]* .*vitest'` first and
  `kill -9 <pid>` only the run you started. (D-021)

## Committing while writers are live

**The lead does not commit while a writer agent is still working.** Not for
the reason `D-023` was filed on — read the installed `lint-staged` (16.2.6)
before repeating that one. Its "Backing up original state... in git stash"
line does **not** clear the working tree here. The tree-clearing
`git stash push --keep-index` branch runs only under `hideUnstaged`, which
defaults false and is not set in `package.json`; the branch that does run is
`git stash create` + `git stash store`, which snapshots and leaves every file
on disk. So nothing is taken off disk for the length of a hook run, and a
concurrent read inside that window sees current content.

The hazard is the **failure** path. On any task error, `restoreOriginalState`
runs `git reset --hard HEAD` and then re-applies the snapshot taken at hook
start. The reset discards every working-tree modification repo-wide, and an
edit a live writer wrote _after_ that snapshot is not in it — so the edit is
gone outright: not in the stash, not on disk, and not named in the output.
This repo runs `vitest related --run` on every `*.{ts,tsx}` commit, so a red
related test reaches that path routinely. That is the loss the rule prevents,
and it is worse than the one the filing described.

Avoiding it costs almost no parallelism: writer agents may still run
concurrently on disjoint files (`SESSION.md` step 4 permits it explicitly),
it is only the _commits_ that serialize — commit an item once every writer
has finished, not as each one reports while others are still going.

Configuring the hook with `lint-staged --no-stash` would genuinely close the
hole — it implies `--no-revert`, so the destructive reset can never fire —
and it is still not this session's call. It removes the rollback net for
every contributor's commit, leaving half-`eslint --fix`ed files on disk when
a hook fails, which is a change to a shared developer contract; and it edits
hook wiring, which `CLAUDE.md` puts outside an unattended session's authority.
It stays a decision for Sam. Note also that `--no-stash` would **not** sweep
unrelated unstaged edits into the commit, which an earlier draft of this
section claimed: tasks only ever run on staged files, a wholly-unstaged file
is never in that list, and partially-staged files have their unstaged hunks
hidden and restored independently of the backup stash.

Observed 2026-08-21 (6th run): two commits ran while another writer was live
and both restored cleanly, so this remains a latent race rather than a
confirmed loss — but it is silent, and would present as "the agent's edit
vanished". (D-023)

## Verification commands that define green

Run in this order; stop at the first red result:

```
npm run type-check
npm run lint
npm run format:check
npm run test:coverage
npm run knip:circular
npm run lint:control-chars
npm run lint:cited-paths
npm run test:storybook       # ALWAYS — see below; it is a hard CI gate
npm run build                # anything touching vite.config.ts, manifest.json, src/background, src/content
```

### `test:storybook` is not optional at baseline

It **runs in this sandbox**, and it is a hard CI gate (the `storybook` job),
so a nightly session runs it at step 1 like every other gate above. It needs
the pre-installed Chromium pinned explicitly — the default Playwright
resolution looks for a build that is not installed:

```
VITEST_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  npm run test:storybook
```

This entry exists because it was previously listed as _conditional on what the
diff touches_, and three consecutive sessions skipped it at baseline for
browser cost. `D-017` — a red `storybook` job — therefore sat on `main`
undetected across two nights while `verify` stayed green. A gate nobody runs
is a gate nobody trusts.

Two traps worth knowing when a story-suite failure names a file the diff never
touched:

- **Vitest orders test files largest-first.** The first file processed is
  whatever is biggest, currently `shared/ActionBar.stories.tsx`. A dep-optimizer
  reload during startup kills whatever is in flight, so that file is the
  standing bystander victim — its name in a failure is evidence about _ordering_,
  not about the file.
- **This class of failure does not reproduce locally.** The suite passes here
  with and without the fix; only the runner differs. Same shape as `D-010`.
  Treat "green here, red in CI" as a timing question, and let CI be the proof
  rather than declaring the gate environmental.

`npm run knip` / `npm run knip:production` are advisory only (CI runs them
`continue-on-error: true`) — informative for `DEBT.md` triage, never a gate.
Full ladder and the "results you should not trust" caveats live in the
`okta-verify` skill; this list is the subset a nightly session must run
before opening its PR.
