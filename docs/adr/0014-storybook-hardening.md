# ADR-0014: Storybook hardening — enforce a11y, side-panel viewports, fixed-element framing

- Status: Accepted
- Date: 2026-07-23
- Builds on / supersedes parts of: ADR-0011 (closes its a11y `todo → error` follow-up)

## Context

ADR-0011 made Storybook the single docs site and ran every story as a
browser test, but left three rough edges: the a11y addon ran in report-only
`todo` mode (violations surfaced but never failed), there was no way to preview
the width-responsive side-panel behaviour (`useIsNarrow(640)` condenses the
`ActivityBar`), and `position: fixed` components rendered off-canvas — the
`ActivityBar` pinned to the bottom of an otherwise-blank page and escaped the
autodocs preview block, reading as empty.

## Decision

**1. Enforce a11y (`test: 'error'`).** `.storybook/preview.tsx` promotes the a11y
addon from `todo` to `error`: an axe violation fails the story in the browser
suite. This closes the ADR-0011 follow-up. The gate was made green by fixing the
real gaps rather than suppressing rules:

- `ActivityBarView` progress bar got an `aria-label` (`aria-progressbar-name`).
- The shared `Select` associates its `<label>` with the control via `useId`
  (`select-name`); the label-less story supplies an `aria-label`.
- `SearchDropdown`'s icon-only clear buttons got accessible names (`button-name`).
- `EntityPicker` card titles went `h4 → h2` to sit one level under the page `h1`
  (a genuine `heading-order` skip).
- `GroupComparisonModal`'s blank matrix corner `<th>` got an `sr-only` name +
  `scope` (`empty-table-header`).

The only suppressions are `heading-order` disabled at the meta level on
page-fragment stories (`RulesTab`, `UsersTab`, `ExportContextBar`,
`GroupComparisonModal`), which render a panel/modal out of its page heading
context (no ancestor `<h1>`), each with an inline comment.

**2. Side-panel viewport presets.** `preview.tsx` registers `sidepanelCompact`
(360px), `sidepanelDefault` (480px) and `sidepanelWide` (720px) under the
Viewport toolbar, straddling the 640px breakpoint, so a reviewer can preview the
compact vs. full `ActivityBar` in the explorer. No preset is the default (stories
still fill the canvas). The presets resize the explorer preview only; the headless
runner keeps its own window size, so automated width-dependent coverage goes
through the presentational prop (`ActivityBarView`'s `collapsed`).

**3. Fixed-element framing.** `.storybook/decorators.tsx` exports
`inSidePanelFrame`: a wrapper whose `transform` establishes a containing block so a
descendant `position: fixed` element anchors to a bounded, panel-sized frame and
renders in view (canvas + autodocs). Applied to `ActivityBar`/`ActivityBarView`;
the pattern is the answer for any future fixed component.

## Consequences

- No new dependencies. `a11y.test: 'error'` means a future story with an axe
  violation fails CI — fix the component (preferred) or, for a true isolation
  artifact, disable the specific rule at the narrowest scope with a comment.
- Story render/interaction coverage is unchanged (479 tests, all green under
  `error` mode); the a11y fixes also improve the shipped app's accessibility.
- **Deferred (each its own PR/decision):**
  - _Story-driven coverage in the gate._ `test:coverage` runs `--project unit`
    only. Folding in the `storybook` browser project would need Chromium in the
    `verify` CI job, browser-v8-coverage is less stable, and the number is
    naturally low (~48%: `coverage.all` counts every source file, and no story
    imports `background/`, `content/`, most hooks/utils — plus stories aren't
    exhaustive branch tests), so the 80/75 thresholds would need recalibration or
    scoping to storied files. Not a fold-in.
  - _Visual regression._ Chromatic stays out (ADR-0010, SaaS/cost); a local
    Playwright screenshot-snapshot path is reachable via the existing
    `@vitest/browser-playwright` but needs a baseline/flakiness decision.
  - _Interaction-assertion expansion_ and _global `autodocs` tag_ — additive
    polish, left for a focused follow-up to keep this change reviewable.
