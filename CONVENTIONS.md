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

**Decision (new — this was previously undefined):** there is currently no
code anywhere in the scheduler or content-script path that distinguishes an
expired-session 401 from any other failed request (confirmed — zero hits
searching for `401`/session-expiry handling). Nightly runs should **not**
improvise a fix inline; this needs scoping first. Filed as `D-007` in
`DEBT.md`, `blocked:needs-breakdown`. Until it's scoped and implemented, an
expired session surfaces as an ordinary failed-request error state — that's
the current (undesirable but real) behavior; don't paper over it with a
one-off try/catch in whatever file a nightly run happens to be touching.

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
  `perl -e 'alarm 240; exec @ARGV' npx vitest run <file>`, then
  `pkill -9 -f vitest` regardless of outcome.

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
npm run test:storybook       # anything touching components/shared, cache/, useOktaApi, or a zod schema
npm run build                # anything touching vite.config.ts, manifest.json, src/background, src/content
```

`npm run knip` / `npm run knip:production` are advisory only (CI runs them
`continue-on-error: true`) — informative for `DEBT.md` triage, never a gate.
Full ladder and the "results you should not trust" caveats live in the
`okta-verify` skill; this list is the subset a nightly session must run
before opening its PR.
