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
npm run test:run      # vitest once
npm run test:coverage # coverage (thresholds 80/75)
npm run docs             # regenerate docs/api (TypeDoc from source comments)
npm run storybook        # component explorer dev server (:6006)
npm run build-storybook  # static Storybook build (CI gate)
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
| Build / lint / CI / release / versioning       | `docs/development.md`                              | —                           |
| Documenting code / TypeDoc / API comments      | `docs/development.md`                              | `docs-maintainer`           |
| Writing / updating a spec or ADR               | `docs/README.md` + the affected doc                | `docs-maintainer`           |
| Understanding the whole system                 | `docs/architecture.md`                             | —                           |

## Continuing the maintainability work

Remaining refactors have a living, ordered plan: **`docs/refactoring-plan.md`**.
After a context clear, read that + this file, pick the top unchecked item, keep it
small, verify green, repeat.

## Where things are

- Specs: `docs/` (index at `docs/README.md`). Decisions: `docs/adr/`. Baseline
  audit + backlog: `docs/audit/`.
- Shared UI: `src/sidepanel/components/shared/`. Icons: `overview/shared/Icon.tsx`.
- API client: `src/sidepanel/hooks/useOktaApi/` (module-per-concern pattern).
- Shared utils: `src/shared/utils/` (`logger`, `oktaUrl`, `dateFormat`, …).

## Working agreement

Prefer reusing what exists over adding new code. After edits: `type-check`, `lint`,
and `prettier --write` touched files; add/keep tests green. Land refactors
tests-first and one component per change.
