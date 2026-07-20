# ADR-0011: Storybook is the single documentation site; browser story tests

- Status: Accepted
- Date: 2026-07-16
- Builds on / supersedes parts of: ADR-0010 (component explorer)

## Context

ADR-0010 adopted Storybook as the component explorer and deliberately deferred
the Vitest/browser addon and kept documentation split across three surfaces:
component autodocs (in Storybook), the TypeDoc **HTML** API site (`docs/api`), and
the prose specs + ADRs (Markdown in `docs/`, readable only in the repo). Nothing
ran the stories as tests, and there was no single place to browse everything or a
deployed site to share.

## Decision

**1. Storybook is the single documentation site.** All documentation is surfaced
in one Storybook build, in three sidebar sections:

- **Components** — stories + autodocs (component TSDoc), as before.
- **Internals** — the auto-generated API reference for the non-component code
  (hooks, scheduler, cache, shared utils, types, background, content). TypeDoc is
  repurposed to emit **Markdown** (`typedoc-plugin-markdown`), bundled per
  subsystem (`.storybook/scripts/bundle-internals.mjs`) and rendered as MDX pages.
  The standalone TypeDoc **HTML** site is retired.
- **Documentation** — the prose specs (`docs/*.md`) and ADRs (`docs/adr/*.md`),
  rendered as MDX pages.

Doc/Internals MDX wrappers are generated (`.storybook/scripts/gen-doc-pages.mjs`)
into a gitignored dir and render their Markdown via the Storybook `Markdown` doc
block (rendered as data — no MDX parsing of the source). Hook-coupled components'
autodocs carry a **"Related internals"** cross-link block to the API pages they
use. `npm run docs` now generates the Internals Markdown (not HTML).

**2. Stories run as browser tests.** `@storybook/addon-vitest` runs every story as
a headless-browser render test (play functions become interaction tests) in a
second Vitest project (`storybook`), alongside the existing jsdom `unit` project.
`test:run` targets `--project unit` (fast, browser-free); `test:storybook` runs the
browser suite; CI runs both. `storybook-addon-pseudo-states` is added for
hover/focus/active previews.

**3. The site deploys to GitHub Pages** via `.github/workflows/deploy-pages.yml`
on push to `main`.

## Consequences

- Adds dev deps: `@storybook/addon-vitest`, `@vitest/browser-playwright`,
  `playwright`, `storybook-addon-pseudo-states`, `typedoc-plugin-markdown`. No
  runtime deps.
- `docs/api` HTML is gone; the API reference now lives in Storybook's `Internals`
  section (`.storybook/generated/` is generated + gitignored).
- One shareable URL for components, API, and specs; PRs that break a story fail CI.
- Browser tests need Chromium; CI installs it, local runs pin the sandbox binary
  via `VITEST_BROWSER_EXECUTABLE`. The husky pre-commit and `test:run` stay
  browser-free (`--project unit`).
- Irreducibly-heavy stories (e.g. `UsersTab`, the throwing `ErrorBoundary` case)
  are excluded from the runner via the `!test` tag but remain in the explorer.
- The 80/75 coverage gate is enforced in CI (the `verify` job runs
  `npm run test:coverage`; thresholds live in `vitest.config.ts`).
- The Storybook a11y addon runs in `test: 'todo'` mode (`.storybook/preview.tsx`):
  violations surface in the a11y panel but do not fail the run. Promoting it to
  `'error'` (so a11y violations fail CI) is accepted future work, gated on an
  a11y cleanup pass first.
