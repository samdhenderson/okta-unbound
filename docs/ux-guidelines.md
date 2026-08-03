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

The shared `Modal` provides all of these — `role="dialog"` + `aria-modal="true"`,
the Tab focus-trap, autofocus, focus restoration on close, and Escape-to-close — so
every consumer inherits them without re-implementing the semantics.

### Tabs (e.g. UserComparisonModal)

`role="tablist"`/`tab"`/`tabpanel"`, `aria-selected`, `aria-controls` wiring, roving
`tabIndex`, and arrow-key navigation between tabs.

## Pushed views (in-tab drill-in)

A drill-in built on `useViewStack` (ADR-0016) is **not** a dialog: it replaces the
list in the page flow rather than overlaying it. So it takes half of `Modal`'s focus
contract and deliberately drops the other half:

- **Move focus on push.** Focus goes to the first focusable element in the pushed
  view, or to its container — give that container `tabIndex={-1}` so it can receive
  focus when it has no focusable child.
- **Restore focus on pop**, to the element that triggered the push. This only works
  if that element is still in the document, which is one more reason to keep the list
  mounted rather than unmounting it.
- **No focus trap, and no `aria-modal`.** Nothing behind a pushed view is inert, so
  the tab bar and the activity bar must stay reachable by keyboard. Trapping focus
  here would strand a keyboard user in a region they can see past.
- **Breadcrumbs carry the way back.** Render the `trail` through the shared
  `Breadcrumbs` in `PageHeader`'s slot: ancestor crumbs are buttons, the current one
  is plain text with `aria-current="page"`. The back button and the current crumb are
  the same affordance — do not give them competing labels.

## Loading / empty / error states

Every async view handles all three explicitly — never a blank panel:

- **Loading**: `LoadingSpinner`.
- **Empty**: `EmptyState` with a clear message and (where useful) an action.
- **Error**: `AlertMessage` with `type="danger"` and an actionable message. Do not
  swallow errors silently or show raw sentinels (e.g. `unknown@unknown.com`, see
  `useOktaApi/core.ts:63-77`).

## Status colors → meaning

`success` (completed/healthy), `warning` (caution/attention), `danger`
(failure/destructive), `info` (neutral note). Use tokens, never raw hex.

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
