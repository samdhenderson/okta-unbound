# Components

Shared UI lives in [`src/sidepanel/components/shared/`](../src/sidepanel/components/shared/)
and [`src/sidepanel/components/overview/shared/`](../src/sidepanel/components/overview/shared/).
Feature components live under `components/{groups,users,overview}/`.

## Hard rules

1. **Never hand-roll a `<button>`, `<input>`, `<select>`, or `<textarea>`** in a
   feature component. Use `Button`, `Input`, `Select`, `Textarea`. If a shape is
   missing (e.g. a filter chip / toggle), add a variant to the shared component —
   don't inline bespoke classes. (Audit: 54 raw `<button>`s to migrate.)
2. **Import from the barrel** `components/shared` — not deep paths. The barrel must
   export every shared component (currently incomplete — see below).
3. **No raw hex / no ad-hoc spacing** — see [design-system.md](./design-system.md).
4. **Icons come from the `Icon` registry** (`overview/shared/Icon.tsx`, 25 typed
   icons, `currentColor`). Don't inline `<svg>` in feature code.

## The variant/size convention

Every configurable component uses a **`Record<Variant, string>` lookup map** plus a
composed `baseClasses` string. Follow this exact pattern (see `Button.tsx`,
`AlertMessage.tsx`, `Modal.tsx`, `Icon.tsx`):

```tsx
export type FooVariant = 'primary' | 'secondary' | 'danger';
const variantClasses: Record<FooVariant, string> = {/* … */};
const sizeClasses: Record<FooSize, string> = { sm: '…', md: '…', lg: '…' };
```

- Size scale is `sm | md | lg`. Express sizing in Tailwind classes only — do **not**
  add parallel inline pixel `style` maps (Button currently does this at
  `Button.tsx:58-62,96`; collapse it).
- Variant/status names use the shared `StatusType` (`success | warning | danger |
info`) — never `error`.

## Catalog

`shared/`: `Button`, `Modal`, `Input`, `Select`, `Textarea`, `PageHeader`,
`CollapsibleSection`, `AlertMessage`, `EmptyState`, `LoadingSpinner`,
`ScrollableList`, `SearchDropdown`, `SelectionChips`.
`overview/shared/`: `Icon`, `StatCard`, `QuickActionsPanel`.

**Barrel gap:** `shared/index.ts` exports only `Button, Modal, Input, Select,
Textarea, PageHeader, CollapsibleSection`. Add the remaining six
(`AlertMessage, EmptyState, LoadingSpinner, ScrollableList, SearchDropdown,
SelectionChips`) and migrate deep imports.

## When to build vs reuse

- Reuse a shared component if one exists (check the catalog first).
- Extend via a new variant/prop if the difference is stylistic.
- Build a new shared component only for a genuinely new primitive; put it in
  `shared/`, follow the variant/size convention, add it to the barrel, and note it
  here. Delegate this to the `component-builder` agent.
- Composition over configuration: large feature UIs (e.g. a comparison modal) are
  built by composing primitives, and should be split into subcomponents rather than
  growing past ~300 lines (see [state-management.md](./state-management.md)).
