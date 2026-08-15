## Okta Unbound — how to build with this library

These are the primitives of a Chrome **side-panel** extension for Okta administration.

### Design for a narrow column

Every screen renders in a Chrome side panel the user drags to width. Design for
**480px** by default; **360px** is the realistic floor and **720px** the ceiling.
Prefer stacked layouts, wrapping toolbars, and truncation over multi-column grids.
A layout that needs 900px is wrong for this product.

### Setup

No theme provider or root wrapper is required — importing `styles.css` is enough,
and every component is styled the moment it mounts.

One exception: `EntityLink` (and `DetailSection`, which embeds it) renders a
_navigable chip_ only when a navigation handler exists for that entity kind, and
degrades to plain text otherwise — deliberately, so a link is never dead. To show
the chip state, wrap in the `NavigationProvider` export:

```jsx
<NavigationProvider
  handlers={{ rule: () => {}, group: () => {}, user: () => {}, app: () => {}, policy: () => {} }}
>
  <EntityLink type="group" id="00gFAKE1a2b3c4d5e6" name="Engineering" />
</NavigationProvider>
```

Omit a handler for a kind to demonstrate the plain-text fallback. Use fake Okta ids
(`00g…` groups, `00u…` users, `0oa…` apps, `0pr…` rules) — never real ones.

### Styling idiom: Tailwind v4 utilities over semantic tokens

Style with utility classes. **Never write a hex colour** — every colour is a token.
The families, with their real names:

| Purpose                                                   | Classes                                                                                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Brand                                                     | `bg-primary`, `bg-primary-light`, `bg-primary-highlight`, `text-primary-text`, `border-primary`                                     |
| Status (the vocabulary is **`danger`**, never `error`)    | `bg-danger`/`-light`, `text-danger-text`; same shape for `success`, `warning`, `info`                                               |
| Accent (user-context surfaces only)                       | no utility is compiled — use `style={{ background: 'var(--color-accent)' }}`                                                        |
| Surfaces                                                  | `bg-canvas` (the gray page backdrop), `bg-white` (cards)                                                                            |
| Neutrals — 50/100/200/300/400/500/600/700/900, **no 800** | `text-neutral-900` headings, `text-neutral-700` body, `text-neutral-600` labels, `text-neutral-400` disabled, `border-neutral-200`  |
| Type                                                      | `text-xs` meta · `text-sm` body · `text-base` emphasis · `text-lg` titles; `font-medium`, `font-semibold`; `font-mono` for Okta ids |
| Shape & space                                             | `rounded-md`; padding `p-3` / `px-4 py-2`; gaps `gap-2` / `gap-3`                                                                   |

**Surfaces follow a strict rule:** a gray `bg-canvas` page with white cards floating
on it. A card is `bg-white` + a 1px `border-neutral-200` — **elevation comes from the
border, never a shadow**. Hover on an interactive card shifts the border to
`border-neutral-300`. Shadows are reserved for true overlays (`Modal`, dropdowns).

Motion uses tokens too — `duration-(--dur-quick)` and the `--ease-standard` family.
Never write a raw `ms` value or `cubic-bezier()`.

**The stylesheet is compiled, not the whole of Tailwind.** It contains the classes
these components actually use — a broad, comfortable vocabulary (flex/grid, the
spacing scale, `truncate`, `rounded-*`, `w-full`, `justify-between`, …), but not every
class Tailwind can generate. If a class appears to do nothing, it was never compiled:
substitute a neighbouring class that is in `styles.css`, or set the property inline
with a `var(--color-*)` / `var(--dur-*)` token. Every token above exists as a custom
property even where its utility does not.

### Reach for a primitive before styling a div

Never hand-roll a `<button>`, `<input>`, `<select>`, `<textarea>`, a list row, or a
modal — each already exists and carries the focus, keyboard, and ARIA behaviour:
`Button`, `IconButton`, `StretchedButton`, `Input`, `Select`, `Textarea`, `Checkbox`,
`Modal`, `ListRow`, `ScrollableList`. `Modal` supplies `role="dialog"`, a focus trap,
focus restoration, and Escape-to-close — a bespoke overlay would ship none of that.

Compose pages from `PageHeader` (title, subtitle, badge, identity region), `ActionBar`
(sticky bulk actions), `DetailSection` / `CollapsibleSection` (labelled panels),
`Breadcrumbs`, `Tabs`, and state components `EmptyState`, `AlertMessage`,
`LoadingSpinner`, `Skeleton`.

### Where the truth is

`_ds/<folder>/styles.css` and the files it imports are the real, complete stylesheet —
read them before inventing a class. Each component's `.prompt.md` and `.d.ts` next to
its preview are the authoritative prop contract.

### A representative screen

```jsx
<div className="bg-canvas h-full p-3">
  <PageHeader title="Engineering" subtitle="Manage Okta group membership" />
  <div className="mt-3 rounded-md border border-neutral-200 bg-white p-3">
    <div className="flex items-center gap-2">
      <Input placeholder="Filter members…" />
      <Button variant="primary">Add group</Button>
    </div>
    <p className="mt-3 text-xs text-neutral-600">1,284 members</p>
  </div>
</div>
```
