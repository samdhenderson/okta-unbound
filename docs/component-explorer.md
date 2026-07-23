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

## Story documentation contract

Both templates share the same documentation bar. The autodocs page a story
generates is only as good as what the story tells it, so every `.stories.tsx`
follows these four rules. `Button.stories.tsx` is the Template-A reference;
`RuleImpactModal.stories.tsx` is the Template-B (doc-block) reference.

1. **`argTypes` descriptions.** Every prop that shows up as a Control gets a
   one-line `argTypes` description mirroring the source `/** */` comment — the
   Controls table should document what a prop does, not just its type. Don't
   restate the type (react-docgen already prints it); reach for
   `table.category` only when a component has enough props to warrant grouping.
   **Required on `shared/` primitives; best-effort on feature components.**

   ```tsx
   argTypes: {
     variant: { description: 'Visual emphasis; `primary` is the page call to action.' },
     loading: { description: 'Shows a spinner and disables the button while an action is in flight.' },
   },
   ```

2. **`docs.description.component`.** Every `meta` carries a multi-line component
   block — what the component is and its notable states — not just the one-line
   JSDoc over `meta`. Hook-coupled containers additionally end the block with a
   **"Related internals"** line cross-linking the API pages they use, exactly as
   `RuleImpactModal.stories.tsx` does:

   ```tsx
   parameters: {
     docs: {
       description: {
         component:
           'One-line what-it-is.\n\nA paragraph on the notable states.\n\n' +
           '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs)',
       },
     },
   },
   ```

3. **Canonical state-story names.** Name the standard states consistently so the
   sidebar is scannable: **`Loading`, `Empty`, `ErrorState`, `Disabled`.** Rename
   divergent exports to match (`WithError`/`Error` → `ErrorState`, `EmptyGroup` →
   `Empty`, …). Genuinely distinct semantic variants keep their own names
   (`Searching`, `Scanning`), but the canonical state uses the canonical name.
   Renaming a story export is safe — no test imports a `.stories` file
   (`composeStories` is unused); the browser suite auto-discovers stories.

4. **Per-story a11y.** Add `parameters.a11y` only where it clarifies intent, and
   ship an accessible-name story for icon-only components (see
   `IconButton.stories.tsx`). The global mode stays `a11y.test: 'todo'`
   (report-only) — do **not** flip it to `'error'` (that's ADR-0011 future work).

### Sidebar taxonomy

Story `title`s are `Section/Component`. Feature components live under their
feature root; the app shell gets one root. There is **no `Components/` root** —
route each container to where it belongs:

- **`Rules/`** — the rules tab, cards, and rule modals (`RulesTab`, `RuleCard`,
  `RuleImpactModal`, `RuleConsolidationModal`).
- **`Groups/` · `Users/` · `Overview/`** — the corresponding tab and its feature
  components (`GroupsTab`, `UsersTab`, `OverviewTab`, …).
- **`Export/`** — the export flow.
- **`Shared/`** — reusable primitives (`components/shared/`).
- **`Sidepanel/`** — app-shell chrome that isn't feature-specific (`ActivityBar`,
  `ActivityBarView`, `TabNavigation`, `ContextBar`, `ErrorBoundary`,
  `AuditLogViewer`).

The `Introduction.mdx` landing page is titled **`Getting Started`** so it sorts
as its own root rather than colliding with the `Overview/*` component group.

## Why `useOktaApi`, not MSW

The side panel never calls `fetch` — all Okta API traffic flows
`side panel → background (ApiScheduler) → content script`
(`docs/architecture.md`), so MSW's request interception has nothing to catch
here. Mocking is done one layer up, at the `useOktaApi` facade boundary itself
(a Vite `resolveId` alias in `main.ts`), plus a fake `chrome` global for the
providers that poll it on mount. Do not wire up MSW in stories.

**Mock stability matters.** The real facade returns one _memoized_ object whose
operation identities are stable across renders. The mock must honour that: its
default value is built **once** and returned as a singleton (and
`mockReturnValue` hands back a single object too). If the mock instead returned a
fresh object per render, any consumer effect that lists an op in its dependency
array (e.g. `useAddToGroup`'s debounced group search) would re-run and `setState`
every render, looping until React throws "Maximum update depth exceeded" and the
story canvas crashes. Keep the mock's identities stable.

## Coverage expectation

Every new or changed `shared`/leaf feature component ships a co-located story in
the same change — same bar as tests (`docs/testing.md`). Reviewed at PR time; an
un-storied shared/leaf component is backlog, caught at review. God components and
hook-only extraction targets aren't required to get a story just because they were
touched — story the presentational pieces that come out of them. The full catalog
is currently covered (all stories run as browser tests). The a11y addon runs in
`test: 'error'` mode (`.storybook/preview.tsx`) — an axe violation fails the story
in the browser suite. (This closes the former ADR-0011 `todo → error` follow-up:
the cleanup pass fixed the real gaps — a named progress bar, labelled selects,
named icon buttons — and a handful of page-fragment stories disable `heading-order`
locally, since a standalone panel has no ancestor `<h1>`.)

CI gate: `build-storybook` runs as a parallel job in `.github/workflows/ci.yml`
(ADR-0005) — a story that fails to type-check or build fails the PR.

## Side-panel viewport presets

`preview.tsx` registers three side-panel width presets under the toolbar's
**Viewport** control: `sidepanelCompact` (360px, below the 640px `useIsNarrow`
breakpoint), `sidepanelDefault` (480px) and `sidepanelWide` (720px). The
extension lives in a Chrome side panel the user drags freely, and `ActivityBar`
condenses below 640px — switch a story to the compact preset to preview that
collapse in the explorer. No preset is the default, so stories fill the canvas as
before. (Note: the presets resize the explorer preview; the headless test runner
renders at its own window size, so exercise width-dependent logic through the
presentational prop — e.g. `ActivityBarView`'s `collapsed` — for automated
coverage.)

## Fixed / bottom-anchored components

A `position: fixed` component (the `ActivityBar`/`ActivityBarView`, which pin to
`bottom-0`) otherwise renders at the bottom of an empty page in the canvas and
escapes the autodocs preview block entirely. Wrap those stories in the shared
`inSidePanelFrame` decorator (`.storybook/decorators.tsx`): a `transform` on the
wrapper establishes a containing block, so the fixed bar anchors to a bounded,
panel-sized frame and renders in view, in context. Reach for it whenever a new
component is `position: fixed`.

## Stories as browser tests (`@storybook/addon-vitest`, ADR-0011)

`vitest.config.ts` has two projects: `unit` (jsdom, the ~940 existing tests) and
`storybook` (headless-browser, every story becomes a render test; the 11 `play`
functions become interaction tests). Scripts:

```
npm run test:run         # jsdom unit project only (fast, browser-free)
npm run test:storybook   # the browser story suite
```

CI runs both (the `storybook` job installs Chromium). Locally, set
`VITEST_BROWSER_EXECUTABLE` to a Chromium path to skip the download. A story that
genuinely can't run headless (e.g. a deliberately-throwing one) is opted out with
the `!test` tag — `tags: ['autodocs', '!test']` — and stays in the explorer.
a11y is enforced (`preview.tsx` `a11y.test: 'error'`): a story with an axe
violation fails the suite.

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
