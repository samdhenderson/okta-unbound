# design-sync notes — Okta Unbound

Working notes for syncing this repo's design system to claude.ai/design.
Read this **before** touching `.design-sync/config.json`.

Project: `95a23085-7685-4b3f-9986-bedec30d1b07` — <https://claude.ai/design/p/95a23085-7685-4b3f-9986-bedec30d1b07>

## Invocation

```sh
node .ds-sync/package-build.mjs --config .design-sync/config.json \
  --node-modules ./node_modules \
  --entry src/sidepanel/components/shared/index.ts --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle
node .ds-sync/storybook/compare.mjs --out ./ds-bundle \
  --storybook-static .design-sync/sb-reference --components <names>
```

`--entry` is mandatory: this repo is a Chrome MV3 **application**, not a published
package, so `node_modules/okta-unbound` does not exist for the converter to resolve.

## Scope

Deliberately limited to the 30 `Shared/*` design-system primitives — the parts a
design agent actually composes with. The other 96 storied components (Groups, Users,
Overview, Export, Rules, Policies, Apps, tab shells) are page-level compositions with
heavy data dependencies; they are excluded via `titleMap: {<Name>: null}`.
**To widen scope, delete entries from `titleMap`** — nothing else needs to change.

## Fixes and why

- **[GENERAL] `exported PascalCase symbols: 0` → 0 components, despite a correct
  98 KB bundle.** The converter's export gate is `exportedNames()` →
  `findTypesRoot()`, which reads `package.json`'s `types` field — it does **not**
  read the bundle it just built. With no `types` field it found nothing, so all 126
  storybook titles fell out as `[TITLE_UNMAPPED]`.
  **Fix:** added `"types": "src/sidepanel/components/shared/index.ts"` to the root
  `package.json`. The field is inert (this package is never published or consumed as
  a dependency) and points at the real barrel, which ts-morph parses directly —
  `.ts` source works, a built `.d.ts` tree is not required.
  _Do not remove that field_ — the sync silently produces zero components without it.

- **[GENERAL] `titleMap` keys are the SHORT component name**, i.e. the last segment
  of the story title (`AppsTab`), **not** the full title (`Apps/AppsTab`). Keying by
  full title excludes nothing and fails silently — the build just reports
  `[TITLE_UNMAPPED]` again with the same count.

- **[GENERAL] `! preview decorator bundle failed: Could not resolve "tailwindcss"`.**
  `.storybook/preview.tsx` imports `src/sidepanel/tailwind.css`, whose first line is
  the Tailwind v4 `@import 'tailwindcss'` directive — esbuild cannot resolve it, so
  the decorator chain (ErrorBoundary → ProgressProvider → SchedulerProvider) is not
  bundled as the preview wrapper.
  **Assessed as harmless for this scope, not worked around:** no component under
  `components/shared/` references `useProgress`, `useScheduler`, `ProgressContext`,
  or `SchedulerContext`, so those two providers are not needed. Component styling
  still ships correctly via `[CSS_FROM_STORYBOOK]`, which scrapes the **compiled**
  CSS out of the storybook build and sidesteps the directive entirely. `cfg.provider`
  is therefore deliberately unset.
  **If scope widens beyond `shared/`, this stops being harmless** — feature
  components do use those contexts, and they will need `cfg.provider` (the provider
  components must first be reachable as bundle exports, e.g. via `cfg.extraEntries`).
  Note the shared primitives are _not_ context-free in general — see the
  `NavigationContext` entry below, which is a different failure with a different fix.
  Checked and cleared: `OpenInOktaLink` reads no React context at all (only the pure
  `oktaAdminEntityUrl` helper), so it is _not_ affected by the context trap.

- **[GENERAL] The duplicate-React-context trap — `EntityLink` rendered dead plain
  text.** `EntityLink` calls `useEntityNavigation()` from
  `src/sidepanel/contexts/NavigationContext`, and its story supplies a
  `NavigationProvider` via a `meta.decorators` entry. Everything compiled correctly
  — provider present, decorator applied, `fn()` stubs callable — and the preview
  _still_ rendered the unlinkable fallback (plain text, dotted underline, no
  chevron) while storybook rendered the indigo chip.
  **Cause:** `NavigationContext.tsx` was bundled **twice** — once inside
  `_ds_bundle.js` as an internal dependency of `EntityLink`, and again into the
  preview via the story's relative `../../contexts/NavigationContext` import. Two
  `createContext()` calls means two distinct context objects: the story's provider
  published to one, `EntityLink` read the other, got the module-scope
  `NO_NAVIGATION` default, and `canNavigateTo` returned `false`.
  **Fix (both halves are required):**
  `cfg.extraEntries: ["./src/sidepanel/contexts/NavigationContext.tsx"]` puts
  `NavigationProvider` on `window.OktaUnbound`, and
  `cfg.storyImports.shim: ["contexts/NavigationContext"]` forces the story's
  relative import to resolve to that global instead of re-bundling a second copy.
  **This is the failure mode to watch for whenever a shared component reads a React
  context that a story provides.** It cannot be seen in the build or validate logs —
  both were green — and it is invisible in the contact sheet at normal scale. Only
  the full-resolution compare pair showed it. If scope widens, audit every context
  the same way: `grep -rn "useContext\|use[A-Z].*Context" src/sidepanel/components/shared/`.
  Do NOT "fix" a case like this by neutralizing the story or hand-authoring an owned
  preview that fakes the provider — that hides the very defect the sync exists to
  catch.

- **Fonts were declared but never loaded.** `--font-primary`/`--font-mono` named
  Inter and Roboto Mono, but no `@font-face` or font file existed anywhere in the
  repo and `src/sidepanel/index.html` loads only `tailwind.css` — the shipping panel
  silently rendered `-apple-system`. Vendored the latin woff2 subsets into
  `src/sidepanel/fonts/` with `@font-face` in `tailwind.css`, and pointed
  `cfg.extraFonts` at the same two files so the design project ships them too.
  Self-hosted, not CDN: the MV3 CSP forbids remote font origins.
  This fixed the extension as well as the sync.

- **Card-layout overrides** (presentation only — these do not move grades):
  - `Modal` → `cardMode: "single"`, `primaryStory: "WithFooter"`. Modal content is
    `position: fixed`, so in a grid card it escapes its cell and paints over
    siblings (`[GRID_OVERFLOW] … escape`).
  - `ActionBar`, `CopyableId`, `Tabs` → `cardMode: "column"`. Their stories render
    wider than a grid cell and the cell clip crops them (`[GRID_OVERFLOW] … wide`).

- **[GENERAL] `storybook-addon-pseudo-states` stories can never match — 7 skipped.**
  `Button`, `FilterPill`, `IconButton` and `StretchedButton` each carry `Hover` /
  `Focus` stories that set `parameters: { pseudo: { … } }`. The addon rewrites CSS in
  storybook to force `:hover` / `:focus-visible`; the compiled preview has no such
  addon, so storybook shows the hovered state while the preview shows the resting
  one — a guaranteed mismatch that is not a component defect. All 7 are in
  `cfg.overrides.<Name>.skip`.
  **Any new `pseudo:` story must be skipped too**, or it will grade `mismatch`
  forever. Find them with:
  `grep -rn "pseudo:" src/sidepanel/components/shared/*.stories.tsx`
  Consequence worth knowing: `IconButton`'s `danger` / `subtle` / `active` variants
  are visually identical to `default` at rest — their colour lives entirely in the
  hover/focus states these skipped stories covered. The resting render is still
  verified on both panels; the hover appearance is simply not verified by this sync.

- **`EntityIdentity` — `Empty` story skipped** (`shared-entityidentity--empty`).
  The component renders _nothing_ when every row is empty; that is its documented
  contract ("an empty row is dropped rather than rendered as blank space"). The story
  is therefore legitimately blank, sorts first alphabetically in the card, and trips
  the `rootEmpty` render check. The other six stories cover the component fully.

- **`Breadcrumbs` — `Empty` story skipped** (`shared-breadcrumbs--empty`).
  Same class as `EntityIdentity.Empty`: the component does `if (items.length === 0)
return null`, so the story renders nothing and compare reports `sb-error`
  ("no storybook root content") — it fails in storybook too, so there is nothing to
  compare. The other five stories cover it.
  Checked and NOT skipped: `ScrollableList.Empty` and `SelectionChips.Empty` both
  render real empty-state content, and `EmptyState.Empty` is the empty state.

- **`OpenInOktaLink` — `No Origin` story skipped** (`shared-openinoktalink--no-origin`).
  Passes `oktaOrigin: null`; the component renders nothing when the org origin or
  entity id is missing, so storybook has no root content either (`sb-error`).

- **`Skeleton` — `Default` and `Text Narrow` skipped** (`shared-skeleton--default`,
  `shared-skeleton--text-narrow`). The `text` variant wraps a `w-full` line in a
  width-less `<div>`; under the story's `layout: 'centered'` that wrapper is an
  auto-width flex item, so the line resolves to **0px** and storybook renders no
  visible child. Both panels agree — there is nothing to compare.
  _This is a latent story-quality bug in the repo, not a sync artefact:_ the two
  stories that are supposed to demonstrate the `text` skeleton variant currently
  show nothing in Storybook itself. Giving the wrapper a width (or dropping
  `layout: 'centered'` for them) would make them real again. 4 of Skeleton's 6
  stories remain and cover the `row` and `card` variants.

## Grading technique (saves a wave's worth of false alarms)

**The compare sheet's two columns are scaled independently** — storybook's
`layout: centered` shot is cropped tight and blown _up_, while the preview shot is the
whole capture viewport shrunk _down_. On small components this manufactures deltas
that do not exist: `LoadingSpinner` looks half-size in the preview column (both rings
measure 32px), and `EmptyState`'s icon looks black there (it is `indigo-600`).
**Always open the `raw/` pair before grading anything small or subtly coloured.**
For a reliable zoom, load both raw PNGs as `<img>` in fixed-size `overflow:hidden`
boxes with `transform: scale(N)` and `page.goto()` a written HTML file — `setContent`
blocks `file://` images, and macOS `sips --cropOffset` crops from the _centre_, so a
naive top-left crop of a 900x700 shot comes back blank.

## Re-sync risks

What can silently go stale or was verified only partially. Fixes above record what was
done; this section is what the _next_ run should distrust.

- **`package.json`'s `types` field is load-bearing for this sync and for nothing else.**
  Any tidy-up that removes it (a dependency audit, a "this package isn't published"
  cleanup, knip) drops the sync to **zero components** — and the build still exits 0.
  If a re-sync reports `exported PascalCase symbols: 0`, check that field first.

- **Stories that express their variant through `parameters.viewport` verify nothing
  here.** Neither panel applies the viewport, so both sides render unconstrained and
  the pair matches _vacuously_. Confirmed on `EntityIdentity.Narrow` (meant to prove
  fact rows wrap at 360px) and `CopyableId.Truncated` (meant to prove id truncation).
  Both are graded `match` and both are honest about the pixels — they simply do not
  test what their names claim. Any new story that encodes its variant in `viewport`
  joins this list. The fix, if these variants matter, is a width decorator in the
  story rather than anything in the sync.

- **Story caps — captured but not individually graded.** The compare cap is 6 stories
  per component. Tails not individually graded: `Input` 6/18 (the ungraded tail holds
  the `icon`/`trailing` adornment slots and the sm/md/lg size scale — **the most
  worthwhile cap to raise**), `IconButton` 6/11, `ScrollableList` 6/9, `Button` 6/8,
  `CopyButton` 6/8, `ListRow` 6/7, `AlertMessage` 6/7, `Checkbox` 6/7, `Select` 6/7,
  `SelectionChips` 6/7, `EmptyState` 6/7, `SearchDropdown` 6/8, `Modal` 6/9,
  `PageHeader` 6/15. Raise with `compare.mjs --max-stories <n>`; existing verdicts
  survive. Note these components are _verified-by-upload in full_ on future syncs even
  though their tails were never graded — that trust is inherited, not re-earned.

- **Hover and focus appearance is unverified by construction.** The 7 pseudo-state
  stories are skipped, so `IconButton`'s `danger`/`subtle`/`active` variants — whose
  colour exists _only_ in hover/focus — are verified at rest and nowhere else. A
  regression in those states would pass this sync silently.

- **`Modal` carries the only owned preview** (`.design-sync/previews/Modal.tsx`). It
  duplicates the generated `compose()` wrapper, so it will **not** pick up future
  improvements to the preview generator, and it hard-codes a 480x640 frame that must
  stay in step with `cfg.overrides.Modal.viewport`. If Modal's stories change shape,
  update this file — a `[STORY_CHANGED]` marker on Modal means it is already stale.

- **A crashed compare run leaves convincing debris.** Modal's first capture recorded
  one `error` ("Target page, context or browser has been closed") plus four bogus
  `sb-error "?"` cells; a plain re-run captured all six cleanly. **Never skip a story
  on the strength of a single failed capture** — re-run first, and only treat a
  failure as real when it survives a clean run.

- **The reference storybook and the vendored fonts must move together.** `sb-reference`
  is gitignored and must be rebuilt whenever `src/` or the stories change; the fonts
  now live in `src/sidepanel/fonts/` and are compiled into it. A `[REFERENCE_STALE?]`
  warning after a source change means every grade that run produced compared against
  the _old_ design.

- **Build assumptions.** Node 26, `npm ci` from `package-lock.json`, Playwright
  chromium. No story loads a remote asset, so `[ASSETS_BLOCKED]` never applied and a
  network-sandboxed shell was never a risk here — that changes the moment a story
  references a CDN image.
