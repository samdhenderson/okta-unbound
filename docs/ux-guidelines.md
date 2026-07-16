# UX & accessibility guidelines

## Modals (required semantics)

The single `Modal` (`components/shared/Modal.tsx`) is used by all overlay features.
Every modal must have:

- `role="dialog"` + `aria-modal="true"` on the panel, `aria-labelledby` pointing at
  the title.
- **Focus trap**: focus moves into the modal on open, cycles within it on Tab, and
  is **restored** to the trigger element on close.
- **Escape closes** the modal (in addition to overlay click and the X button).
- Autofocus a sensible first control (the primary action or first field).

These are currently missing (audit §3) — fix in `Modal.tsx` once so every consumer
inherits it. Prefer a small focus-trap util over a dependency, but a vetted lib is
acceptable if recorded in an ADR.

### Tabs (e.g. UserComparisonModal)

`role="tablist"`/`tab"`/`tabpanel"`, `aria-selected`, `aria-controls` wiring, roving
`tabIndex`, and arrow-key navigation between tabs.

## Loading / empty / error states

Every async view handles all three explicitly — never a blank panel:

- **Loading**: `LoadingSpinner`.
- **Empty**: `EmptyState` with a clear message and (where useful) an action.
- **Error**: `AlertMessage` with `type="danger"` and an actionable message. Do not
  swallow errors silently or show raw sentinels (e.g. `unknown@unknown.com`, see
  `useOktaApi/core.ts:63-77`).

## Status colors → meaning

`success` (completed/healthy), `warning` (caution/attention), `danger`
(failure/destructive), `info` (neutral note). Use tokens, never raw hex
(`ContextBanner` currently violates this).

### Activity bar

Scheduler state and operation progress live in one fixed bottom bar (`ActivityBar`
→ pure `ActivityBarView` + `useActivityBar`, ADR-0008), not two overlapping ones.
Keep its layout **stable**: the status region, the metric slots, and the action
area stay mounted so values swap in place instead of reflowing the row. Cancel is a
single control that stops the operation and drains the queue.

## Keyboard & focus

- All interactive elements reachable and operable by keyboard (using shared
  components gives you this for free).
- Preserve the visible focus ring (`Button` already has
  `focus:outline-2 focus:outline-offset-2 focus:outline-primary`).
- Decorative SVG/dividers get `aria-hidden="true"`.

## Copy

Concise, action-oriented. Destructive actions name the consequence and use the
`danger` variant. Confirm irreversible bulk operations.
