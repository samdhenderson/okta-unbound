---
name: okta-component
version: 1.0.0
description: >-
  How to build or change a UI component in Okta Unbound without hand-rolling a
  native control or missing a house convention — which shared primitive to
  reuse (Input, Button, IconButton, StretchedButton, Modal, ScrollableList,
  MemberSearchBar), the size scales that are NOT uniform across primitives
  (Icon is xs|sm|md|lg|xl at 12/16/20/24/32px, LoadingSpinner is
  sm|md|lg|xl|2xl at 16/20/24/32/48px, and they're deliberately name-aligned
  with each other but not with Button's xs|sm|md|lg or Input's own sm|md|lg), Input's
  icon/trailing adornment slots and their pointer-events/aria-hidden
  requirements, modal a11y (role=dialog, aria-modal, focus trap, focus
  restore, Escape), and the co-located .stories.tsx + axe-clean requirement.
  Use when building or modifying a component under
  src/sidepanel/components/, adding a variant to a shared primitive, wiring
  up a search field or a disclosure chevron, or asked to "add a component",
  "build a modal", "why can't I use a raw <button>", "what size do I pass",
  or "does this need a story".
---

# Okta component

## Scope and stance

Building or changing UI in `src/sidepanel/components/` without rediscovering
the house rules by trial and error. The rules live in `docs/components.md`,
`docs/design-system.md`, and `docs/ux-guidelines.md`; this skill is the
condensed, verified path through them for the moment you're about to write a
component.

## Reuse before you build

Check three places before writing a line of markup: the barrel
(`src/sidepanel/components/shared/index.ts`), the `Icon` registry
(`src/sidepanel/components/shared/Icon.tsx`), and `shared/utils/`.
Most needs are already a prop away:

- **A search field** → compose `Input` + `Icon` + `LoadingSpinner`/`IconButton`,
  the way `src/sidepanel/components/members/MemberSearchBar.tsx` does
  (leading `icon`, a conditional trailing clear `IconButton`). Copy its shape,
  not `SearchDropdown`'s or a hand-rolled div.
- **A loading/empty/no-results ladder** → `ScrollableList`
  (`src/sidepanel/components/shared/ScrollableList.tsx`). It renders the
  `LoadingSpinner` while `loading`, your `emptyState` node when there are no
  children, otherwise its own scroll region — don't reimplement the three-way
  branch in a feature component.
- **Any chevron that opens a region** → `IconButton` with `expanded` +
  `controls` (emits `aria-expanded`/`aria-controls`). Never a bare `<button>`
  with a rotated `<svg>`.
- **A whole card or row that should be clickable** → `StretchedButton`
  (`src/sidepanel/components/shared/StretchedButton.tsx`): an invisible
  absolutely-positioned button behind the card's own controls. It exists
  specifically to avoid `role="button"` on a `<div>` and the axe
  `nested-interactive` violation you get from wrapping card content in a real
  `<button>`. Contract: the card must be a `relative` ancestor, sibling
  controls must be `relative z-10`, and `describedBy` should point at the
  card's own title element so a list of otherwise-identical labels stays
  distinguishable to a screen reader.

If none of the shared primitives can express what a call site needs, **fix the
primitive** — add a variant or a new prop, don't inline bespoke classes next
to it. `docs/components.md`'s "documented raw-control exceptions" list is
short and shrinking by decision, not by accident; adding to it needs an
argument, and the default move is extending the shape that's closest.

## The size scales — this is a live trap

Most primitives use `sm | md | lg`, but they are **not** the same three
pixel values across components, and two primitives extend the scale on
purpose:

- `Icon` (`src/sidepanel/components/shared/Icon.tsx`): `xs | sm | md
| lg | xl` → 12 / 16 / 20 / 24 / 32px.
- `LoadingSpinner` (`src/sidepanel/components/shared/LoadingSpinner.tsx`):
  `sm | md | lg | xl | 2xl` → 16 / 20 / 24 / 32 / 48px, default `xl`.
- Those two are **deliberately name-for-name aligned** over the sizes they
  share (`sm`/`md`/`lg`/`xl` all map to the same pixel value in both) — a
  spinner standing in for a glyph is requested by the glyph's own size name:
  `<LoadingSpinner size="sm" />` next to `<Icon type="search" size="sm" />`
  match at 16px, `size="md"` matches at 20px, and so on.
- `Button` (`src/sidepanel/components/shared/Button.tsx`) has its own
  unrelated `xs | sm | md | lg` scale (≈24 / 36 / 40 / 56px — `xs` is the
  recessed step, reserved for `ActionBar`'s selection register and never for a
  page's own verb) and `Input`
  (`src/sidepanel/components/shared/Input.tsx`) has yet another one (≈30 /
  38 / 46px). **Do not assume `size="sm"` means the same pixels on two
  different primitives** — only `Icon` and `LoadingSpinner` are aligned to
  each other; check the actual `sizeClasses` map in the source before writing
  a size down anywhere (including in a story or a PR description).
- `IconButton` is `sm | md` only (padding `p-1` / `p-1.5` around whatever
  glyph you hand it — the glyph controls its own dimensions).

Extend a scale only when a real call site needs the step, expressed as
Tailwind classes — not a parallel inline-pixel `style` map (`Button.tsx` is
the model: sizing is class-based, nothing computed in JS).

## `Input`'s adornment slots

`Input` (`src/sidepanel/components/shared/Input.tsx`) has two slots that
reserve their own padding automatically, scaled per `size` — this is what
discharged four long-standing raw-`<input>` exceptions (`SearchDropdown`,
`UserSearchBar`, `GroupSearchBar` converged on it; two composites did not,
see below):

- `icon` — a leading glyph. Rendered `pointer-events-none` and
  `aria-hidden="true"` by `Input` itself; left padding (`pl-9`/`pl-10`/`pl-11`
  by size) is reserved so text never runs under it.
- `trailing` — a clear button, a spinner, a unit suffix. Right padding
  (`pr-10`/`pr-11`/`pr-12`) is reserved automatically. **`trailing` is
  `pointer-events-none` unless you pass `trailingInteractive`.** A decorative
  spinner must not swallow a click aimed at the field; a clickable clear
  button must receive one — that's the entire reason the prop exists, so pass
  it exactly when the trailing node is something the user clicks.

```tsx
<Input
  size="lg"
  value={query}
  onChange={setQuery}
  ariaLabel="Search users"
  icon={<Icon type="search" size="sm" />}
  trailingInteractive
  trailing={
    <IconButton label="Clear search" variant="ghost" size="sm" onClick={clear}>
      <Icon type="close" size="sm" />
    </IconButton>
  }
/>
```

**The same rule applies anywhere you overlay something on a field, not just
inside `Input`.** A decorative glyph absolutely positioned over a control
needs `pointer-events-none` (so a click that lands on the glyph still reaches
the field underneath) and `aria-hidden="true"` (so a screen reader doesn't
announce a shape with no semantic meaning between the label and the control).
`Input` already does both for its own `icon` slot; the two remaining
documented composites that don't compose `Input` — the Add-to-Group
type-ahead and `UserComparisonModal`'s `ComparisonSearchPhase` search field —
carry the same two attributes by hand at their call site, and any new custom
field composite must too. `docs/components.md`'s raw-control exceptions
section names exactly why those two stayed raw (pixel-neutrality — the
`Input` migration cost a few pixels of field height and icon size at every
converted call site) — that is a real, already-litigated trade-off, not
license to leave a new composite unaudited for the same two attributes.

## Never hand-roll

`<button>`, `<input>`, `<select>`, `<textarea>`, `<input type="checkbox">`,
or `<svg>` in a feature component. Use `Button`/`IconButton`/`FilterPill`/
`SortPill`, `Input`, `Select`, `Textarea`, `Checkbox`, and the `Icon`
registry respectively. The exceptions catalog in `docs/components.md`
("Documented raw-control exceptions") is short, shrinking, and each entry
carries an inline `§3 exception` (or `CHARACTERIZED:`) comment at the call
site explaining why. Read that section before deciding a new call site needs
one — the overwhelmingly likely answer is that it doesn't, and the primitive
should grow instead.

## Modals

Always the shared `Modal` (`src/sidepanel/components/shared/Modal.tsx`) —
never a bespoke overlay `<div>`. It already provides, non-negotiably:
`role="dialog"` + `aria-modal="true"` on the panel with `aria-labelledby`
pointing at the title, a Tab focus-trap, autofocus into the panel on open,
focus restoration to the trigger element on close, and Escape-to-close (plus
overlay click and the header × button). If a modal-shaped feature can't fit
`Modal`'s props, extend `Modal` — don't reimplement any part of that contract
next to it. Full detail, including the "pushed view" (`useViewStack`
drill-in) contract that deliberately drops the trap and `aria-modal` half of
this for non-dialog navigation: `docs/ux-guidelines.md`.

## Loading / empty / error, every async view

Never a blank panel while data is in flight or absent. `LoadingSpinner` for
loading, `EmptyState` for no content (icon + title + description + optional
`Button` actions), `AlertMessage` with `type="danger"` for errors — status
vocabulary is `danger`, never `error` (ADR-0002), and the `AlertMessageData.type`
field is typed to the shared `StatusType` union (`success | warning | danger |
info`) so passing anything else is a type error, not a lint nit.

## Stories: required, and they're a real test

**Every new or changed `shared` or leaf feature component ships a co-located
`.stories.tsx` in the same change.** `src/sidepanel/components/shared/Button.stories.tsx`
is the reference to copy. This isn't paperwork — every story is a headless-
browser render test (`npm run test:storybook`, `@storybook/addon-vitest`), and
the a11y addon runs in **`test: 'error'`** mode: a story with an axe violation
fails the suite and fails CI. (`docs/component-explorer.md`'s "Story
documentation contract" section still describes the addon as report-only
`'todo'` mode from before the ADR-0011 cleanup pass — that line is stale
prose; `.storybook/preview.tsx`'s actual `a11y.test` setting, and that same
doc's later "Coverage expectation" section, both say `'error'`. Follow the
code.)

What a plain story (no `play` function) asserts, and doesn't:

- **Does** assert: the component renders without throwing, in each state you
  give a `Story` export, and is axe-clean in that state.
- **Does not** assert: any specific text, prop wiring to a mocked child, or
  behavior on interaction — that needs a `play` function or a `.test.tsx`
  (ADR-0023 already bans testing CSS classes, referential identity, or props
  brokered to a mocked child; don't add a story _and_ a test that both just
  pin a pure render).

Two templates, both documented in `docs/component-explorer.md`: **Template
A** for pure primitives/leaf components (props only, `layout: 'centered'`).
**Template B** for hook-coupled containers/modals (override the
`useOktaApi` mock per variant via `.storybook/mocks/useOktaApi.mock.ts`,
`layout: 'fullscreen'`). Name canonical state stories `Loading`, `Empty`,
`ErrorState`, `Disabled` so the sidebar stays scannable; give every `shared/`
primitive prop an `argTypes` description; give every `meta` a multi-line
`docs.description.component` block. A `position: fixed` component (a bottom
bar, not a modal — `Modal` itself is centered via flex, not `fixed`) needs
the `inSidePanelFrame` decorator or it renders off the bottom of an empty
canvas in the explorer.

## Size and structure

Keep components under ~300 lines; push logic into hooks
(`docs/state-management.md`). This is a target the codebase is still growing
into, not a description of it today — nine components currently exceed it —
so don't treat an existing over-length neighbor as license, and don't feel
obligated to shrink one just because you touched it for an unrelated reason
(that's a separate refactor, and `docs/architecture.md` /
`architecture-refactor` is the path for it).

## No raw hex, tokens only

Every color in `src/sidepanel/components/**` maps to an Odyssey token
(`bg-primary`, `text-neutral-700`, `border-danger`, …), defined once in
`src/sidepanel/tailwind.css`'s `@theme` block. A lint/review gate greps for
raw hex in that tree; the only legitimate multi-stop-palette exception is
chart/dataviz ramps (`src/sidepanel/theme/chartPalette.ts`, outside
`components/**`). If a color you need doesn't exist as a token yet, add the
token — don't inline the literal. Full palette, neutral scale, and the
`sm|md|lg` spacing scale: `docs/design-system.md`.

## Verify, don't assume

The size-scale numbers, the adornment padding classes, the a11y-mode claim
above — all were checked against the current source while writing this skill,
not copied from another doc. Do the same before repeating a size or a class
name from here in a PR: primitives get extended, and a stale number in a
skill is worse than no number, since it reads as verified when it isn't.

## Additional resources

- `docs/components.md` — hard rules, the full catalog, the raw-control
  exceptions list with rationale, and "List rows derive; they never fetch."
- `docs/design-system.md` — tokens, typography, spacing scale.
- `docs/ux-guidelines.md` — modal semantics in full, pushed-view (drill-in)
  focus contract, loading/empty/error, keyboard/focus, copy tone.
- `docs/component-explorer.md` — both story templates in full, the
  documentation contract, `npm run shoot` for a pixel-accurate look without
  booting the extension.
- `docs/state-management.md` — where logic goes when a component would
  otherwise cross ~300 lines.
- `component-builder` agent — delegate building or modifying a shared/feature
  component to it; it's built to this same contract.
