# Component explorer (Storybook)

**Storybook 10** (`@storybook/react-vite`, Vite builder) is the component
explorer for shared and feature UI. Decision + rationale: ADR-0010.

## Running it

```
npm run storybook        # dev server, http://localhost:6006
npm run build-storybook  # static build to storybook-static/ (gitignored)
```

Config lives in `.storybook/`:

- `main.ts` — merges the app's own Vite config (so Tailwind v4 tokens and the
  `@` alias come for free), strips the `@crxjs` MV3 plugins (they require the
  extension manifest and break a plain web build), and aliases the `useOktaApi`
  facade module to `.storybook/mocks/useOktaApi.mock.ts`.
- `preview.tsx` — imports `src/sidepanel/tailwind.css` (Odyssey tokens), installs
  a benign `chrome` fake, and wraps every story in the real provider stack:
  `ErrorBoundary → ProgressProvider → SchedulerProvider`.
- `.storybook/mocks/` — `chrome.ts` (fake `chrome.*` surface) and
  `useOktaApi.mock.ts` (a `vi`-free `fn()`-based spy plus the
  `makeUseOktaApiValue()` fixture factory).

Addons: core `storybook` + `@storybook/addon-a11y` + `@storybook/addon-docs` +
`@storybook/addon-vitest` (browser story tests) + `storybook-addon-pseudo-states`
(hover/focus/active previews). No Chromatic, no MCP addon.

## Where stories live

**Colocated in `src`**, next to the component, as `<Component>.stories.tsx` —
mirroring `.test.tsx` colocation. Not a parallel `stories/` tree. They are
strictly type-checked by `tsc` (part of `npm run type-check`) and excluded from
TypeDoc (`typedoc.json`) and the `react-refresh/only-export-components` lint
rule (`eslint.config.js`) via glob overrides, the same treatment `*.test.tsx`
files get.

The reference example is
[`Button.stories.tsx`](../src/sidepanel/components/shared/Button.stories.tsx) —
copy its shape for a new story.

## Two templates

Every `meta` uses `tags: ['autodocs']`.

### Template A — pure primitives / leaf components

Props only. No providers or mocks to wire up — the global decorator in
`preview.tsx` already supplies them; they're just inert for a component that
doesn't touch context or `useOktaApi`. Use `parameters: { layout: 'centered' }`.

```tsx
const meta = {
  title: 'Shared/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { children: 'Add group', onClick: fn() },
} satisfies Meta<typeof Button>;
```

One `Story` export per variant/size/state worth seeing (see `Button.stories.tsx`:
`Default`, `Primary`, `Danger`, `Ghost`, `Disabled`, `Loading`, `WithBadge`,
`Sizes`).

### Template B — hook-coupled containers / modals

Providers still come from the global decorator — don't wrap the story in your
own. When the component calls `useOktaApi` directly, override the mocked return
value per variant:

```tsx
import { useOktaApi, makeUseOktaApiValue } from '../../../../.storybook/mocks/useOktaApi.mock';

export const Loading: Story = {
  play: async () => {
    useOktaApi.mockReturnValue(makeUseOktaApiValue({ isLoading: true }));
  },
};
```

Use `parameters: { layout: 'fullscreen' }` (the extension renders in a narrow
side panel; this is also the `preview.tsx` default, so Template B usually
doesn't need to set it explicitly — Template A is the one that overrides to
`centered`).

## Why `useOktaApi`, not MSW

The side panel never calls `fetch` — all Okta API traffic flows
`side panel → background (ApiScheduler) → content script`
(`docs/architecture.md`), so MSW's request interception has nothing to catch
here. Mocking is done one layer up, at the `useOktaApi` facade boundary itself
(a Vite `resolveId` alias in `main.ts`), plus a fake `chrome` global for the
providers that poll it on mount. Do not wire up MSW in stories.

## Coverage expectation

Every new or changed `shared`/leaf feature component ships a co-located story in
the same change — same bar as tests (`docs/testing.md`). Reviewed at PR time; an
un-storied shared/leaf component is backlog, tracked in
`docs/refactoring-plan.md`. God components and hook-only extraction targets
aren't required to get a story just because they were touched — story the
presentational pieces that come out of them.

CI gate: `build-storybook` runs as a parallel job in `.github/workflows/ci.yml`
(ADR-0005) — a story that fails to type-check or build fails the PR.

## Stories as browser tests (`@storybook/addon-vitest`, ADR-0011)

`vitest.config.ts` has two projects: `unit` (jsdom, the 752 existing tests) and
`storybook` (headless-browser, every story becomes a render test; the 9 `play`
functions become interaction tests). Scripts:

```
npm run test:run         # jsdom unit project only (fast, browser-free)
npm run test:storybook   # the browser story suite
```

CI runs both (the `storybook` job installs Chromium). Locally, set
`VITEST_BROWSER_EXECUTABLE` to a Chromium path to skip the download. A story that
can't run headless (e.g. `UsersTab`, or a deliberately-throwing one) is opted out
with the `!test` tag — `tags: ['autodocs', '!test']` — and stays in the explorer.
a11y runs in report-only mode (`preview.tsx` `a11y.test: 'todo'`).

## One docs site: Components + Internals + Documentation (ADR-0011)

The static build is the whole documentation site, three sidebar sections:

- **Components** — stories + autodocs (component TSDoc).
- **Internals** — the auto-generated API reference for non-component code. TypeDoc
  emits Markdown (`typedoc-plugin-markdown`), `bundle-internals.mjs` groups it per
  subsystem, and `gen-doc-pages.mjs` writes MDX wrappers that render it via the
  `Markdown` doc block. Refresh with `npm run docs`.
- **Documentation** — `docs/*.md` specs + `docs/adr/*.md`, rendered the same way.

Both scripts write to `.storybook/generated/` (gitignored); `build-storybook` runs
them first. Hook-coupled components carry a **"Related internals"** cross-link block
(`parameters.docs.description.component`) to the API pages they use — add one when
you build a new hook-coupled component. The site deploys to GitHub Pages via
`.github/workflows/deploy-pages.yml` (enable Settings → Pages → Source = GitHub
Actions once).
