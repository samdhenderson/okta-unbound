# CLAUDE.md

Guidance for Claude Code working in this repo. **This file is a router, not a
manual.** Depth lives in `docs/`. Load only the doc row(s) that match your task —
do not read all docs (that's context bloat).

## Project

**Okta Unbound** — a Chrome MV3 side-panel extension for Okta group/user admin.
Stack: React 19, TypeScript 5.9 (`strict`), Tailwind v4, Vite + `@crxjs/vite-plugin`,
Vitest + Testing Library + MSW, `idb`. ~22k LOC.

## Commands

```
npm run dev           # dev build (load dist/ as an unpacked extension)
npm run build         # production build
npm run type-check    # tsc --noEmit
npm run lint          # eslint (0 errors required; warnings are legacy debt)
npm run format        # prettier --write
npm run test:run      # vitest jsdom unit project (browser-free)
npm run test:storybook   # run every story as a headless-browser test
npm run test:coverage # coverage (thresholds 80/75)
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

- **Never modify or delete an existing test to make it pass.** If a test seems
  wrong, flag it in the PR description and stop — don't edit it unilaterally.
  Editing a test's setup/mocks/fixtures is fine when the underlying behavior
  legitimately changed; editing its assertions or deleting a case to silence a
  failure is not. (ADR-0012, `docs/testing.md`)
- **No raw hex.** Use Odyssey tokens; add a token before inlining a color.
  (`docs/design-system.md`)
- **Never hand-roll a `<button>/<input>/<select>/<textarea>`** — use the shared
  components; import from the `components/shared` barrel. (`docs/components.md`)
- **No raw `console.*`.** Use `src/shared/utils/logger.ts`. **Never log XSRF tokens,
  request/response bodies, or PII** — identifiers and outcomes only.
  (`docs/development.md`)
- **No new `any`.** Validate Okta responses at the boundary with zod. (ADR-0006)
- **Modals** need `role="dialog"`, `aria-modal`, focus trap, focus restore, and
  Escape-to-close — use the shared `Modal`. (`docs/ux-guidelines.md`)
- **Version** comes from `package.json` only — never hardcode it. (ADR-0007)
- **Status vocabulary is `danger`, not `error`.** (ADR-0002)
- Keep components under ~300 lines; push logic into hooks. (`docs/state-management.md`)
- **Document exports with TypeDoc JSDoc.** Every module opens with a
  `@module`/`@description` header; exported functions/hooks/components/types get doc
  comments (feeds `npm run docs`). (`docs/development.md`)
- **Every new/changed `shared` or leaf feature component ships a co-located
  `.stories.tsx`.** (`docs/component-explorer.md`)

## Security hardening rules (non-negotiable)

These govern every future change, human- or AI-authored. Any change touching
messaging, the manifest, storage, exports, logging, or Okta-response handling
should be reviewed with `security-logging-reviewer`.

- **No secrets in the repo — ever.** Never hardcode or commit Okta API tokens
  (`SSWS …`), session cookies, XSRF tokens, passwords, or real org URLs/IDs —
  including in tests, stories, fixtures, and docs. Use obviously fake
  placeholders (`00gFAKE…`, `user@example.com`).
- **The XSRF token lives only in the content script, per request.** Read it from
  the page DOM at fetch time; never persist it (`chrome.storage` / IndexedDB /
  `localStorage`), never send it across extension messages, never log it.
- **No dynamic code execution.** `eval`, `new Function`, string-arg
  `setTimeout`, and remotely loaded scripts are banned (MV3 CSP enforces this —
  never weaken `content_security_policy` in the manifest). Parse untrusted
  expressions with a real parser (`shared/ruleEvaluator.ts` is the pattern).
- **Treat every Okta response as untrusted input.** Validate at the
  content-script boundary with zod (`src/shared/schemas/okta.ts`, ADR-0006)
  before rendering or branching. Rule expressions, profile attributes, and
  group names are end-user-controllable — sanitize accordingly.
- **Message passing stays validated.** The background listener rejects foreign
  senders and tab-originated `scheduleApiRequest`; the content script only
  fetches same-origin paths with an allow-listed HTTP method. Every new message
  action must validate sender + message structure the same way. Never add
  `externally_connectable` or an `onMessageExternal` listener without an ADR.
- **Host checks parse hostnames.** Use `shared/utils/oktaUrl.ts` for every "is
  this Okta?" decision; substring-matching URLs is banned.
- **Least privilege in the manifest.** Adding any permission, host permission,
  API scope, or broader match pattern requires an ADR justifying why the
  narrowest alternative is insufficient; remove permissions when the last
  feature using them goes.
- **Escape all export output.** Every CSV cell goes through
  `csvUtils.escapeCSV` (RFC 4180 quoting + spreadsheet-formula-injection
  guard); never string-interpolate cells into export content.
- **Rendering stays XSS-safe.** Rely on React's escaping;
  `dangerouslySetInnerHTML` and hand-built HTML strings are banned. External
  links must be built from the validated `oktaOrigin` plus a validated ID, with
  `rel="noopener noreferrer"`.
- **Store no more than needed.** `chrome.storage` and IndexedDB are plaintext:
  never put credentials or session material there; keep cached PII minimal and
  TTL'd (`shared/cache.ts`), and respect audit retention settings.

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
| Documenting code / TypeDoc / API comments      | `docs/development.md`                              | `docs-maintainer`           |
| Writing / updating a spec or ADR               | `docs/README.md` + the affected doc                | `docs-maintainer`           |
| Understanding the whole system                 | `docs/architecture.md`                             | —                           |

## Maintainability overhaul — complete

The 2026-07 maintainability overhaul (format/lint/coverage gates, `console`→logger,
shared-primitive migration, `error`→`danger`, zod boundary, god-component
decomposition, scheduler transport unification) is **done**. The _why_ behind each
decision is in `docs/adr/`. A few accepted deferrals remain as future work, recorded topically at
their natural home rather than a central backlog: list-path zod validation
([adr/0006](docs/adr/0006-zod-boundary-validation.md)), the Storybook a11y
`todo`→`error` promotion ([adr/0011](docs/adr/0011-storybook-single-docs-site.md)),
and the remaining raw-control exceptions / a future `TextLink` primitive
([docs/components.md](docs/components.md)).

## Where things are

- Specs: `docs/` (index at `docs/README.md`). Decisions: `docs/adr/`. Feature
  backlog: `docs/features-plan.md`.
- `AGENTS.md` (repo root): a thin cross-tool pointer back to this file — project
  description + commands only. Keep in sync via `docs/development.md`.
- Shared UI: `src/sidepanel/components/shared/`. Icons: `overview/shared/Icon.tsx`.
- API client: `src/sidepanel/hooks/useOktaApi/` (module-per-concern pattern).
- Shared utils: `src/shared/utils/` (`logger`, `oktaUrl`, `dateFormat`, …).

## Working agreement

Prefer reusing what exists over adding new code. After edits: `type-check`, `lint`,
and `prettier --write` touched files; add/keep tests green. Land refactors
tests-first and one component per change.
