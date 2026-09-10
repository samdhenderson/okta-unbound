# CLAUDE.md

Guidance for Claude Code working in this repo. **This file is a router, not a
manual.** Depth lives in `docs/` and `.claude/skills/`. Load only the row(s) that
match your task — do not read all docs (that's context bloat).

## Project

**Okta Unbound** — a Chrome MV3 side-panel extension for Okta group/user admin.
Stack: React 19, TypeScript 5.9 (`strict`), Tailwind v4, Vite + `@crxjs/vite-plugin`,
Vitest + Testing Library, `idb`. ~47k LOC of source.

## Commands

```
npm run dev           # dev build (load dist/ as an unpacked extension)
npm run build         # production build
npm run type-check    # tsc --noEmit
npm run lint          # eslint (0 errors required; warnings are legacy debt)
npm run format        # prettier --write
npm run test:run      # vitest jsdom unit project (browser-free)
npm run test:storybook   # run every story as a headless-browser test
npm run test:coverage # coverage gate (thresholds in vitest.config.ts)
npm run knip             # unused files/exports/deps  (knip:production, knip:circular)
npm run docs             # TypeDoc → Markdown for the Storybook Internals section
npm run storybook        # component + docs explorer dev server (:6006)
npm run build-storybook  # static docs site (components + Internals + Documentation)
npm run capture          # film the demo chapters that changed
npm run capture:check    # judge the footage: settle, scroller, opening frame
npm run studio           # Remotion studio - edit the reel with no re-shoot
npm run reel:look        # see a frame or a contact sheet of an act (~2s) - start here
npm run reel:draft       # render one chapter or act, cheap, to watch the motion
npm run reel:plan        # regenerate plan.generated.json + CUT.generated.md
npm run reel:identical   # prove a refactor did not move the picture
npm run reel             # render clips/okta-unbound-reel.mp4
npm run reel:vo:budget   # per-beat narration time budget, derived from the cut
npm run reel:vo:targets  # rewrite NARRATION.md's Target: lines from the real cut
npm run reel:vo:measure  # ffprobe captures/vo/ -> reel/src/vo.generated.ts
npm run reel:vo:check    # narration gate: every act voiced, every line inside its budget
npm run ad:look          # look at the store page ad (a separate 19s cut, reel/AD.md)
npm run ad:draft         # render the ad cheaply, with sound
npm run ad               # render clips/okta-unbound-ad.mp4
npm run sfx              # synthesise the ad's sound effects with ffmpeg
```

## Message-passing model (the one thing to know)

```
Side panel (useOktaApi)  →  Background (ApiScheduler: rate limit)  →  Content script (fetch to Okta)
```

API calls happen **only** in the content script (it holds the live Okta session +
XSRF token; nothing is persisted). **All API traffic must go through the scheduler
path** — never add direct side-panel→content calls that bypass rate limiting.
Details: `docs/architecture.md`.

## Hard rules (non-negotiable)

- **Never weaken a test to make it pass.** Editing setup/mocks/fixtures is fine when
  behavior legitimately changed; rewriting an assertion or deleting a case to silence
  a failure is not. If the assertion looks wrong, flag it in the PR and stop.
- **Removing a test is different from silencing one** — allowed when the subject was
  deleted, a story already asserts the same render, the unit was replaced and the
  suite is retargeted assertion-by-assertion, or the assertion pins something we
  deliberately don't test. Each needs a PR note saying what stays covered.
- **Don't test CSS classes, referential identity, or props brokered to mocked
  children**; don't ship both a test and a story for a pure-render component.
  (`docs/testing.md`)
- **Assert or withhold — never hedge.** No "likely", "approximately", "probably",
  or a `?` appended to a label. State the fact, or name the absence and its reason.
  **Uncertainty is a defect, not a disclosure:** a feature that cannot state its
  answer with certainty is unfinished, and the fix is to go and find out — fetch
  the missing field, or narrow the question until it is answerable. Shipping a
  qualifier is not an option. (`docs/claims.md`)
- **A correctness decision never reads a string written for a human.** Evidence
  lives in the type — a `deduced` flag, a reason code, a three-valued union — so
  copy can be rewritten without moving a gate. (`docs/claims.md`)
- **Absent is not zero.** A fact that has not loaded renders as absent, never as
  `0`. A verb with no wired handler is omitted, not shipped `disabled` forever.
- **No raw hex.** Use Odyssey tokens. (`docs/design-system.md`)
- **No raw `ms` or `cubic-bezier()`.** Use the motion tokens (`--dur-*`, `--ease-*`).
  (`docs/motion.md`)
- **Never hand-roll a `<button>/<input>/<select>/<textarea>`** — import from the
  `components/shared` barrel. (`docs/components.md`)
- **Never hand-roll a list-row container** — use shared `ListRow` (`density`,
  `state`, `as`). Row interiors follow the typography contract in
  `docs/surfaces.md`.
- **Never call the shared `ActionBar` directly from a detail page** — wrap it in
  an `<Entity>ActionBar` component (`UserActionBar` is the reference shape), even
  for a single action. A verb defaults to the row if reversible or read-only, and
  to the tier behind **More** — with a confirm `Modal` and the consequence stated
  in plain language — if it changes entity state with no symmetric undo. Never
  declare an `ActionDescriptor` with no wired handler. (`docs/action-bars.md`)
- **The header describes the entity; the body must not repeat it.** A detail rung
  passes `identity`/`identityKey` to `PageHeader`, fed by a pure per-entity
  descriptor builder (`groupIdentity`, `userIdentity`) — never a second identity
  card. `ContextBar` describes the _live Okta tab_, `PageHeader` what you are
  _browsing_; the two never converge. (`docs/page-shell.md`)
- **A sticky band publishes its measured height** — `--header-h`, published by
  `PageHeader`. Never hard-code a sticky offset. The rail is not sticky and
  publishes nothing. (`docs/page-shell.md`)
- **No raw `console.*`.** Use `src/shared/utils/logger.ts`. **Never log XSRF tokens,
  request/response bodies, or PII** — identifiers and outcomes only.
- **No new `any`.** Validate Okta responses at the boundary with zod.
- **Modals** need `role="dialog"`, `aria-modal`, focus trap, focus restore, and
  Escape-to-close — use the shared `Modal`. (`docs/ux-guidelines.md`)
- **Version** comes from `package.json` only — never hardcode it.
- **Status vocabulary is `danger`, not `error`.**
- **Tabs stay mounted** — gate every fetch, poll, and shared listener on `isActive`.
  (`docs/state-management.md`)
- **Every multi-call Okta operation runs through `coreApi.runOperation`** — never a
  hand-rolled `Promise.all` or `for await`. (`docs/scheduler.md`)
- Keep components under ~300 lines; push logic into hooks. (`docs/state-management.md`)
- **Document exports with TypeDoc JSDoc** — `@module`/`@description` file header plus
  doc comments on exports (feeds `npm run docs`). (`docs/development.md`)
- **Every new/changed `shared` or leaf feature component ships a co-located
  `.stories.tsx`**, and it must be axe-clean. (`docs/component-explorer.md`)

## Security invariants (non-negotiable)

Full posture, threat model, and rationale: `docs/security.md`. Any change touching
messaging, the manifest, storage, exports, logging, or Okta-response handling should
be reviewed with `security-logging-reviewer`.

- **No secrets in the repo, ever** — no `SSWS` tokens, cookies, XSRF values,
  passwords, or real org URLs/IDs, including in tests, stories, fixtures, and docs.
  Use fake placeholders (`00gFAKE…`, `user@example.com`).
- **The XSRF token lives only in the content script, per request** — read from the
  page DOM at fetch time. Never persist, never message, never log it.
- **No dynamic code execution** — `eval`, `new Function`, string-arg `setTimeout`,
  remote scripts. Never weaken the manifest's `content_security_policy`. Parse
  untrusted expressions with a real parser (`shared/ruleEvaluator.ts`).
- **Every Okta response is untrusted** — validate with zod at the content-script
  boundary before rendering or branching. Rule expressions, profile attributes, and
  group names are end-user-controllable.
- **Message passing stays validated** — the background listener rejects foreign
  senders and tab-originated `scheduleApiRequest`; the content script enforces a
  same-origin single-`/` path guard plus an HTTP-method allow-list (deliberately **no**
  path allow-list). New message actions validate sender + structure the same way.
  Never add `externally_connectable` or `onMessageExternal` without an ADR.
- **Host checks parse hostnames** — use `shared/utils/oktaUrl.ts`; substring-matching
  URLs is banned.
- **Least privilege in the manifest** — any new permission, host permission, or
  broader match pattern needs an ADR; remove permissions when their last user goes.
- **Escape all export output** — every CSV cell goes through `csvUtils.escapeCSV`
  (RFC 4180 + formula-injection guard). Never interpolate cells directly.
- **Rendering stays XSS-safe** — rely on React's escaping;
  `dangerouslySetInnerHTML` and hand-built HTML strings are banned. External links
  come from the validated `oktaOrigin` plus a validated ID, with
  `rel="noopener noreferrer"`.
- **Store no more than needed** — `chrome.storage` and IndexedDB are plaintext. No
  credentials or session material; keep cached PII minimal and TTL'd; respect audit
  retention settings.

## Routing table — read ONLY the matching row(s)

| If the task is…                                  | Read                                               | Consider delegating to      |
| ------------------------------------------------ | -------------------------------------------------- | --------------------------- |
| Scoping a feature / adding a tab / a new verb    | `docs/product.md`, then `docs/features-plan.md`    | `feature-ideator`           |
| **Putting a worked-out fact on screen**          | `docs/claims.md`                                   | `ui-reviewer`               |
| **Writing user-facing copy**                     | `docs/claims.md`                                   | `ui-reviewer`               |
| Styling / colors / tokens / typography           | `docs/design-system.md`                            | `ui-reviewer`               |
| Cards, elevation, list-row chrome                | `docs/surfaces.md`                                 | `ui-reviewer`               |
| Building / using a shared component              | `docs/components.md`, `docs/design-system.md`      | `component-builder`         |
| Looking up one primitive's prop contract         | `docs/component-primitives.md`                     | `component-builder`         |
| A verb strip, `primary` ranking, refresh         | `docs/action-bars.md`                              | `component-builder`         |
| Shell layout, the rail, sticky bands, view stack | `docs/page-shell.md`                               | `component-builder`         |
| Building / exploring a component visually        | `docs/component-explorer.md`                       | `component-builder`         |
| Storybook viewports, framing, story-as-test      | `docs/storybook-infra.md`                          | —                           |
| Modal / a11y / loading-empty-error UX            | `docs/ux-guidelines.md`                            | `ui-reviewer`               |
| Motion / animation / reduced motion              | `docs/motion.md`                                   | `ui-reviewer`               |
| A scroll-driven or multi-band choreography       | `docs/motion-recipes.md`                           | `ui-reviewer`               |
| Refactoring a god component / pipeline / hooks   | `docs/architecture.md`, `docs/state-management.md` | `architecture-refactor`     |
| Rate limits, concurrency, the plan ledger, 401s  | `docs/scheduler.md`                                | `architecture-refactor`     |
| Adding / fixing tests                            | `docs/testing.md`                                  | `test-writer`               |
| Logging / secrets / validation / `any` removal   | `docs/development.md`                              | `security-logging-reviewer` |
| Security posture / threat model / controls       | `docs/security.md`                                 | `security-logging-reviewer` |
| Residual risks, verifying the posture yourself   | `docs/security-risks.md`                           | `security-logging-reviewer` |
| Build / lint / CI / release / versioning         | `docs/development.md`                              | —                           |
| Finding / removing unused code                   | `docs/dead-code.md`                                | —                           |
| Calling the Okta API / picking an endpoint       | `okta-api` skill                                   | —                           |
| Documenting code / TypeDoc / API comments        | `docs/development.md`                              | `docs-maintainer`           |
| Writing / updating a spec                        | `docs/README.md` + the affected doc                | `docs-maintainer`           |
| Writing an ADR                                   | `docs/adr/README.md`                               | `docs-maintainer`           |
| Understanding the whole system                   | `docs/architecture.md`                             | —                           |
| The reel's or the ad's rules                     | `docs/reel.md`                                     | `reel-cutter`               |
| Changing the reel's cut, beats, or narration     | `okta-reel` skill                                  | `reel-cutter`               |
| Building a reel piece, diagram, or verb          | `okta-reel` skill                                  | `reel-smith`                |
| Filming or re-filming a demo chapter             | `okta-reel` skill                                  | —                           |
| Changing the store page ad or its sound effects  | `reel/AD.md`                                       | `reel-smith`                |
| Unattended nightly maintenance run               | `SESSION.md`, `CONVENTIONS.md`                     | see `SESSION.md`'s roster   |
| Fixing a named correctness bug (`DEBT.md`)       | the cited item's **Problem**/**Done when**         | `bugfix`                    |

## Where things are

- Specs: `docs/` (index at `docs/README.md`). Decisions: `docs/adr/`. Feature
  backlog: `docs/features-plan.md`. Skills: `.claude/skills/`.
- `AGENTS.md` (repo root): a thin cross-tool pointer back to this file — project
  description + commands only. Keep in sync via `docs/development.md`.
- Shared UI: `src/sidepanel/components/shared/`. Icons: `shared/Icon.tsx`.
- API client: `src/sidepanel/hooks/useOktaApi/` (module-per-concern pattern).
- Caching: `src/sidepanel/cache/` (`entityCache` + `useEntityQuery`; every cache key
  literal lives in `keys.ts`).
- Shared utils: `src/shared/utils/` (`logger`, `oktaUrl`, `dateFormat`, …).
- Nightly maintenance system: `SESSION.md` (the sequence), `CONVENTIONS.md`
  (technical standards it enforces), `IMPROVEMENTS.md` / `DEBT.md` (the two
  backlogs, `I-NNN` / `D-NNN` — each ends in a `## Archive` section holding one
  line per closed item; live items only carry the full Problem/Done-when
  write-up), `NIGHTLY.md` (append-only session log).

## Plan-and-approval gate for risky changes

Produce a short plan and stop for explicit go-ahead when a change **commits to an
approach** (new abstraction, data path, storage schema, cache-key grammar, message
action), is **architecturally significant** (it will need an ADR), is
**cross-cutting** (one pattern across many call sites), is **scoped from**
`docs/features-plan.md` / `docs/rockstar-parity-plan.md`, touches the **security
surface**, or **changes an existing contract**. State: **affected files**,
**approach**, **which existing tests to check against**, **any new tests needed**.

**Exempt at any file count:** mechanical mass changes (dead-code deletion, renames,
de-exporting, formatting, dependency bumps), migration slices already approved as
part of a program plan, and single-file fixes with no design content.

The test: _would a reviewer disagree with the approach after the code exists?_ If
yes, plan first. If the only disagreement possible is "you missed one," don't. Use
**plan mode** as the mechanism.

## Architecture decision records

**The corpus was reset on 2026-09-09.** Seventy-four records were deleted and
their surviving rules folded into `docs/*.md` as plain house rules. The practice
continues; the backlog of records does not. Numbering **restarts at 0001**.

- **A rule belongs in a spec doc, not a record.** `docs/` is where a convention
  is looked up. Write an ADR only when the _reasoning_ has to outlive the rule —
  a genuine fork a future reader would otherwise re-litigate.
- **The bar is the plan gate above.** If a change needs a plan, it may need a
  record. If it does not, it does not.
- **State the rule in the owning spec doc in the same PR.** A record nobody can
  find from `docs/README.md` is a record nobody will read. The ADR holds the
  argument; the spec holds the instruction.
- **Old numbers are retired, not reusable.** Roughly 1,270 comments under `src/`
  and `reel/` still cite the deleted corpus by number and have not been swept
  yet. Until they are, a new low number is ambiguous with an old one — so keep
  new records few and make each one earn its place.

## Nightly maintenance system

An unattended session works from `IMPROVEMENTS.md`/`DEBT.md`, follows
`CONVENTIONS.md` for technical standards, and runs the exact sequence in
`SESSION.md`. These are the durable rules that govern it — they live here,
not duplicated into `SESSION.md` or the agent files, so there is one place
that can't drift out of sync with itself:

- **Never merge, never force-push, never skip a hook.** A nightly session
  opens one PR against `main` and stops. Landing it is always a human
  decision.
- **No dependency changes, no `manifest.json` changes.** Both need an ADR
  and Sam's explicit review — file a `DEBT.md`/`IMPROVEMENTS.md` item
  instead of touching either directly.
- **A failing baseline is the whole session.** If the verification ladder
  (`CONVENTIONS.md`) is red before any work starts, the night's only job is
  fixing that — no backlog item gets picked up alongside a red baseline.
- **File cap:** a night implements 2–3 backlog items, one commit per item,
  on branch `nightly/YYYY-MM-DD`. Prefer items that touch disjoint files, and
  prefer files untouched by the last 3 nightly branches, so failures stay
  isolated and reviewable.
- **Read the open PRs before reading the backlog.** An item is marked
  `claimed:` **inside the PR that implements it**, never on `main` — so a
  session that reads `main`'s ledger sees every unmerged night's work as
  `open` again and will happily redo it. Before selecting anything, list the
  open PRs **and their changed files**, then treat both as claimed: every
  `I-NNN`/`D-NNN` named in an open PR, and every file any open PR touches,
  whoever opened it. Ids alone miss the common case — a human's feature
  branch already editing the file an item names, under no item id at all.
  **If three or more PRs from unattended runs are already open, the night
  stops** — append a `NIGHTLY.md` entry saying so and open nothing. Work is
  being produced faster than it is being reviewed, and a fourth PR makes that
  worse, not better.
- **New work discovered mid-session** (a bug noticed while fixing something
  else, a UX inconsistency spotted in passing) gets filed as a new
  `IMPROVEMENTS.md`/`DEBT.md` item, never folded into the current item's
  diff — one concern per commit applies here exactly as it does to any PR.
- **Architecturally significant items stay research-only** until Sam signs
  off on a proposal — same bar as the plan-and-approval gate above. Such an
  item is marked `research:awaiting-review`, and a session **may** claim it:
  the deliverable is a Proposed-status ADR under `docs/adr/`, and its PR
  touches `docs/` only — **zero files under `src/`**. The item moves to
  `open` when Sam accepts the ADR, never by the session that wrote it.
  (`I-008`, `I-012` and `D-007b` are seeded in that state.)
- **Re-verify a stale item before claiming it.** Every backlog item carries
  a `Verified:` date. If it is more than 14 days old, re-check the
  **Problem** with the `okta-claim-check` skill first — enumerate, don't
  sample. If it no longer holds, close it `closed:refuted-<date>` with the
  finding and take the next candidate; **a refuted item is a finished item,
  not a skipped one.** Three of the five items gated as of 2026-08-24 had
  gone stale under code that moved, one of them badly enough that acting on
  it would have deleted a hook nine surfaces depend on.
- **A closed item eventually collapses to one line in `## Archive`** — id,
  title, how it ended, and a link to the commit that addressed it; the
  verbose Problem/Done-when/Risk prose is dropped because it stays
  recoverable from git history. Never archive an item closed by the PR
  still in flight — its commit does not exist yet. Archive it once that PR
  has actually merged to `main`, per `SESSION.md` step 7. An archived id is
  retired for good: `scripts/check-cited-paths.mjs` fails the build if a new
  item reuses one.

## Working agreement

Prefer reusing what exists over adding new code — check `components/shared`, the
`Icon` registry, and `shared/utils/` before writing. After edits: `type-check`,
`lint`, and `prettier --write` touched files; add/keep tests green. Land refactors
tests-first, one component per change.

**One concern per PR.** Don't bundle an unrelated fix in with a feature. History is
squash-merged, so a focused PR is the only thing that stays readable later.
