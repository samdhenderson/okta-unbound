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
  (ADR-0012)
- **Removing a test is different from silencing one** — allowed when the subject was
  deleted, a story already asserts the same render, the unit was replaced and the
  suite is retargeted assertion-by-assertion, or the assertion pins something
  ADR-0023 bans. Each needs a PR note saying what stays covered. (ADR-0022)
- **Don't test CSS classes, referential identity, or props brokered to mocked
  children**; don't ship both a test and a story for a pure-render component.
  (ADR-0023)
- **No raw hex.** Use Odyssey tokens. (`docs/design-system.md`)
- **Never hand-roll a `<button>/<input>/<select>/<textarea>`** — import from the
  `components/shared` barrel. (`docs/components.md`)
- **No raw `console.*`.** Use `src/shared/utils/logger.ts`. **Never log XSRF tokens,
  request/response bodies, or PII** — identifiers and outcomes only.
- **No new `any`.** Validate Okta responses at the boundary with zod. (ADR-0006)
- **Modals** need `role="dialog"`, `aria-modal`, focus trap, focus restore, and
  Escape-to-close — use the shared `Modal`. (`docs/ux-guidelines.md`)
- **Version** comes from `package.json` only — never hardcode it. (ADR-0007)
- **Status vocabulary is `danger`, not `error`.** (ADR-0002)
- **Tabs stay mounted** — gate every fetch, poll, and shared listener on `isActive`.
  (ADR-0018)
- Keep components under ~300 lines; push logic into hooks. (`docs/state-management.md`)
- **Document exports with TypeDoc JSDoc** — `@module`/`@description` file header plus
  doc comments on exports (feeds `npm run docs`). (`docs/development.md`)
- **Every new/changed `shared` or leaf feature component ships a co-located
  `.stories.tsx`**, and it must be axe-clean. (ADR-0010, ADR-0014)

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
  untrusted expressions with a real parser (`shared/ruleEvaluator.ts`). (ADR-0017)
- **Every Okta response is untrusted** — validate with zod at the content-script
  boundary before rendering or branching. Rule expressions, profile attributes, and
  group names are end-user-controllable. (ADR-0006)
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

| If the task is…                                | Read                                               | Consider delegating to      |
| ---------------------------------------------- | -------------------------------------------------- | --------------------------- |
| Styling / colors / tokens / typography         | `docs/design-system.md`                            | `ui-reviewer`               |
| Building / using a shared component            | `docs/components.md`, `docs/design-system.md`      | `component-builder`         |
| Building / exploring a component visually      | `docs/component-explorer.md`                       | `component-builder`         |
| Modal / a11y / loading-empty-error UX          | `docs/ux-guidelines.md`                            | `ui-reviewer`               |
| Refactoring a god component / pipeline / hooks | `docs/architecture.md`, `docs/state-management.md` | `architecture-refactor`     |
| Adding / fixing tests                          | `docs/testing.md`                                  | `test-writer`               |
| Logging / secrets / validation / `any` removal | `docs/development.md`                              | `security-logging-reviewer` |
| Security posture / threat model / controls     | `docs/security.md`                                 | `security-logging-reviewer` |
| Build / lint / CI / release / versioning       | `docs/development.md`                              | —                           |
| Finding / removing unused code                 | `docs/dead-code.md`                                | —                           |
| Calling the Okta API / picking an endpoint     | `okta-api` skill                                   | —                           |
| Documenting code / TypeDoc / API comments      | `docs/development.md`                              | `docs-maintainer`           |
| Writing / updating a spec or ADR               | `docs/README.md` + the affected doc                | `docs-maintainer`           |
| Understanding the whole system                 | `docs/architecture.md`                             | —                           |

## Where things are

- Specs: `docs/` (index at `docs/README.md`). Decisions: `docs/adr/`. Feature
  backlog: `docs/features-plan.md`. Skills: `.claude/skills/`.
- `AGENTS.md` (repo root): a thin cross-tool pointer back to this file — project
  description + commands only. Keep in sync via `docs/development.md`.
- Shared UI: `src/sidepanel/components/shared/`. Icons: `overview/shared/Icon.tsx`.
- API client: `src/sidepanel/hooks/useOktaApi/` (module-per-concern pattern).
- Caching: `src/sidepanel/cache/` (`entityCache` + `useEntityQuery`).
- Shared utils: `src/shared/utils/` (`logger`, `oktaUrl`, `dateFormat`, …).

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
**plan mode** as the mechanism. (ADR-0024, amending ADR-0013)

## Working agreement

Prefer reusing what exists over adding new code — check `components/shared`, the
`Icon` registry, and `shared/utils/` before writing. After edits: `type-check`,
`lint`, and `prettier --write` touched files; add/keep tests green. Land refactors
tests-first, one component per change.

**One concern per PR.** Don't bundle an unrelated fix in with a feature. History is
squash-merged, so a focused PR is the only thing that stays readable later.
