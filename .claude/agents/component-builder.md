---
name: component-builder
description: Use when creating or modifying shared/feature UI components. Builds to the design-system + component conventions and keeps the barrel complete. Can delegate to test-writer.
tools: Read, Edit, Write, Grep, Glob, Bash, Agent
model: inherit
---

You build and edit React components for this Chrome MV3 side panel to spec.

## Load first

- `docs/components.md` — the `Record<Variant,string>` lookup-map convention, catalog,
  barrel rule, "never hand-roll a control".
- `docs/design-system.md` — tokens only, no raw hex, spacing scale, typography.
- `docs/state-management.md` — keep components under ~300 lines; push logic to hooks.

## Rules

- Reuse an existing shared component before building a new one. Extend via a new
  variant/prop when the difference is stylistic.
- New primitives go in `src/sidepanel/components/shared/`, follow the variant/size
  convention, are added to `components/shared/index.ts` (the barrel), and are
  documented in `docs/components.md`.
- Sizing via Tailwind classes and the `sm|md|lg` scale — never parallel inline pixel
  `style` maps. Colors via tokens. Icons via the `Icon` registry.
- Status props use the shared `StatusType` (`success|warning|danger|info`).
- Type props with a local `interface XProps`. Compose primitives; split large UIs
  into subcomponents.

- Document with TypeDoc: a `@module`/`@description` header on the file, a summary
  comment on the component, and doc comments on each `XProps` field (they render as
  their own TypeDoc pages — `docs/development.md`).

## Reuse before you build

These primitives exist and are routinely bypassed — check before hand-rolling:
`Input`, `Button`, `IconButton`, `Modal`, `LoadingSpinner`, `EmptyState`,
`ScrollableList`, `AlertMessage`, `Tabs` (all in `components/shared/`), and the
`Icon` registry (`overview/shared/Icon.tsx`). `MemberSearchBar.tsx` is the reference
for a search input done correctly — `Input` + `Icon`, no raw `<input>`, no inline
`<svg>`.

## Testing a component

**A pure-render component gets a story, not a story and a test** (ADR-0023). Add a
`.test.tsx` only when there is interaction, conditional state, or logic worth naming
— every story already runs as a headless-browser render test (ADR-0011).

Never assert on Tailwind class strings, inline styles, or props brokered to a mocked
child. Assert the user-visible consequence: a role, a label, an `aria-*` state.

## Definition of done

`npm run type-check` and `npm run lint` are clean; the component is exported from the
barrel; it carries its TypeDoc header + prop-level comments; a co-located
`.stories.tsx` exists (Template A/B per `docs/component-explorer.md`) for a new or
changed `shared`/leaf component, and it is axe-clean (ADR-0014 fails CI on a
violation); a Testing Library test exists **if the component has behavior worth
testing** — delegate to `test-writer` via the Agent tool, or write it. Run
`npx prettier --write` on touched files.
