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

### Icons are props, not a component

There is no `Icon` export. Glyphs are reached through the components that take one:
`Button icon`, `EmptyState icon`, and a rail `Tabs` item's `icon`. The registry is
fixed — `users`, `user`, `check`, `alert`, `bolt`, `chart`, `app`, `building`, `lock`,
`refresh`, `download`, `settings`, `trash`, `plus`, `minus`, `search`, `link`,
`external-link`, `pin`, `list`, `hand`, `key`, `sparkles`, `pause`, `shield`,
`clipboard`, `clipboard-check`, `chevron-left`, `chevron-right`, `close`, `clock`.
A name outside that list renders nothing. For a decorative glyph with no component to
hang it on, use a text character or a small `rounded-full` div — never an emoji, and
never an inline SVG copied from elsewhere.

## Page anatomy

Every screen in this product is one of three shapes, inside one shell. Build from
these skeletons rather than inventing a layout.

### The shell

The panel is a single vertical scroller on a gray canvas. Two bands sit above the
content: a **masthead** describing the live Okta browser tab, and an **icon rail** of
the eight top-level sections. Neither is in this library — they are app chrome, so
rebuild them as plain markup when a design needs the whole panel.

The masthead and the page header describe **different things and never converge**: the
masthead says which Okta page the browser is on (`Okta Unbound · Group`, the entity's
name, a connection dot, a Pin toggle); the page header says what you are _browsing in
the panel_. Do not repeat one in the other.

```jsx
// The rail normally measures itself and publishes `--rail-h`. There is no real rail
// in a design, so set the variable by hand or every sticky band below stacks wrong.
<div className="bg-canvas h-screen overflow-y-auto" style={{ '--rail-h': '44px' }}>
  <div className="bg-white border-b border-neutral-200 px-5 py-3 flex items-center justify-between gap-3">
    <div className="flex items-center gap-2.5 min-w-0">
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: 'var(--color-primary)' }}
      />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 leading-none mb-1">
          Okta Unbound · Group
        </div>
        <span className="text-sm font-semibold text-neutral-900 truncate">Engineering</span>
      </div>
    </div>
    <Button size="sm" icon="pin">
      Pin
    </Button>
  </div>

  <nav className="sticky top-0 z-40 bg-white">
    <Tabs
      variant="rail"
      ariaLabel="Main sections"
      activeKey="groups"
      onChange={() => {}}
      tabs={[
        { key: 'overview', label: 'Overview', icon: 'chart' },
        { key: 'users', label: 'Users', icon: 'user' },
        { key: 'groups', label: 'Groups', icon: 'users' },
        { key: 'apps', label: 'Apps', icon: 'app' },
        { key: 'rules', label: 'Rules', icon: 'bolt' },
        { key: 'policies', label: 'Policies', icon: 'shield' },
        { key: 'export', label: 'Export', icon: 'download' },
        { key: 'history', label: 'History', icon: 'clipboard' },
      ]}
    />
  </nav>

  {/* `data-header-scope` is REQUIRED — see the sticky stack below. */}
  <div data-header-scope>{/* one of the three shapes */}</div>
</div>
```

The rail is icon-only except for the active tab, whose label unfurls beside its glyph.
Eight text labels need ~590px and the panel opens at 480.

### The sticky stack

Three bands compete for the top of that one scroller, and each parks below the one
above it. **Never hard-code a sticky offset** — each band measures itself and publishes
its height, and the band below consumes the variable:

| Band                           | Sticks at                               | Publishes                                                     |
| ------------------------------ | --------------------------------------- | ------------------------------------------------------------- |
| Tab rail                       | `top-0`                                 | `--rail-h` on the document root                               |
| `PageHeader sticky`            | `var(--rail-h)`                         | `--header-h`, onto the nearest `[data-header-scope]` ancestor |
| `ActionBar` (default `sticky`) | `calc(var(--rail-h) + var(--header-h))` | —                                                             |

Three consequences that bite in a design:

- **A sticky `PageHeader` must have a `[data-header-scope]` ancestor.** Without one it
  publishes nothing, `--header-h` stays `0px`, and a sticky `ActionBar` slides up
  underneath the header.
- Both variables default to `0px`, so a component shown on its own behaves like a
  plain `top-0` strip. That is correct — don't "fix" it with a literal offset.
- **The scroller needs `[overflow-anchor:none]`.** A pinned `PageHeader` deliberately
  collapses its identity region, losing ~72px above the viewport; Chrome's scroll
  anchoring compensates by pulling `scrollTop` back, which un-pins the header, which
  re-expands the region — and the page grows and shrinks in a loop for anyone
  scrolling slowly. Put it on the same element that owns `overflow-y-auto`:
  `className="bg-canvas h-screen overflow-y-auto [overflow-anchor:none]"`.

A sticky `ActionBar` also **merges into the header as it docks** — over the first 64px
of scroll it bleeds to the panel edges, flattens, covers the header's seam and grows a
shadow, so the two read as one pinned surface. It is automatic (a scroll-driven
animation on the component's own `dock-band` class); render `<ActionBar>` inside a
`px-6` gutter and it lands correctly. Don't restyle the strip to "fix" the flattening.

### The header owns the entity; the body must not repeat it

A detail screen opens with `PageHeader`, and the header is the **single** place the
entity is described. No identity card below it restating the name, the type, or the
id — that pattern is retired. Feed the region a descriptor: `title` is the entity name,
`badge` is its type or status, `identity` is an `EntityIdentity` of fact rows, and
`identityKey` is the Okta id (a changed key crossfades; an unchanged key means the same
entity's data refreshed and swaps silently).

Rows group by category — identity, then counts, then timestamps. **Omit a fact you
don't know rather than showing a zero.**

```jsx
<PageHeader
  sticky
  title="Engineering"
  badge={{ text: 'Rule-managed', variant: 'primary' }}
  identityKey="00gFAKE1a2b3c4d5e6"
  identity={
    <EntityIdentity
      rows={[
        [{ kind: 'id', value: '00gFAKE1a2b3c4d5e6', copyLabel: 'Copy group id' }],
        [
          { kind: 'metric', icon: 'users', value: '1,284', label: 'members' },
          { kind: 'metric', icon: 'bolt', value: '3', label: 'rules' },
        ],
        [{ kind: 'text', icon: 'clock', text: 'Created 12 Mar 2021' }],
      ]}
    />
  }
  actions={
    <OpenInOktaLink
      oktaOrigin="https://example.okta.com"
      entityType="group"
      entityId="00gFAKE1a2b3c4d5e6"
    />
  }
/>
```

### Shape 1 — a list page

Groups, Users, Apps, Policies, Rules. Header, then a fixed control block, then the one
scrolling list. The controls do **not** scroll with the rows.

```jsx
<div data-header-scope>
  <PageHeader
    sticky
    title="Groups"
    subtitle="Manage Okta group membership"
    badge={{ text: '412', variant: 'neutral' }}
    actions={
      <Button variant="secondary" icon="refresh" size="sm">
        Refresh
      </Button>
    }
  />

  <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
      <div className="shrink-0 space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Filter groups…" />
          <Button variant="secondary" icon="settings" badge="2">
            Filters
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterPill active onClick={() => {}}>
            Rule-managed
          </FilterPill>
          <FilterPill active={false} onClick={() => {}}>
            Empty
          </FilterPill>
          <SortPill
            field="members"
            label="Members"
            activeField="members"
            descending
            onToggle={() => {}}
          />
        </div>
      </div>

      <ScrollableList
        emptyState={
          <EmptyState
            icon="users"
            title="No groups match"
            description="Clear the filters to see all groups."
            actions={[{ label: 'Clear filters', onClick: () => {}, variant: 'secondary' }]}
          />
        }
      >
        <ListRow onClick={() => {}} ariaLabel="Engineering">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="min-w-0">
              <div className="text-sm font-medium text-neutral-900 truncate">Engineering</div>
              <div className="text-xs text-neutral-600 truncate">All engineering staff</div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <Badge variant="primary">Rule</Badge>
              <span className="text-xs text-neutral-600">1,284</span>
            </div>
          </div>
        </ListRow>
      </ScrollableList>
    </div>
  </div>
</div>
```

Row interiors follow one contract: `text-sm font-medium text-neutral-900` for the
primary line, `text-xs text-neutral-600` for the secondary, marks and counts right.
Everything truncates — a 360px panel has no room to wrap a group name.

### Shape 2 — a detail rung

Drilling into one entity does **not** replace the page. The list and the detail are
siblings under one header; the list is hidden, never destroyed, so scroll position,
filters, and selection survive the round trip. The header grows a back button and a
breadcrumb trail and re-points its title at the entity.

Then `ActionBar` for verbs whose object is the whole page, then `DetailSection`s. The
split matters: a verb scoped to one section's data belongs in that section's `actions`
slot, not the bar.

```jsx
<div data-header-scope>
  <PageHeader
    sticky
    title="Jane Doe"
    onBack={() => {}}
    backLabel="Back to search"
    breadcrumbs={
      <Breadcrumbs
        items={[
          { key: 'root', label: 'User Search', onSelect: () => {} },
          { key: 'user', label: 'Jane Doe' },
        ]}
      />
    }
    badge={{ text: 'Active', variant: 'success' }}
    identityKey="00uFAKE1a2b3c4d5e6"
    identity={
      <EntityIdentity
        rows={[
          [{ kind: 'text', text: 'jane.doe@example.com' }],
          [{ kind: 'id', value: '00uFAKE1a2b3c4d5e6', copyLabel: 'Copy user id' }],
          [{ kind: 'metric', icon: 'users', value: '14', label: 'groups' }],
        ]}
      />
    }
    actions={
      <OpenInOktaLink
        oktaOrigin="https://example.okta.com"
        entityType="user"
        entityId="00uFAKE1a2b3c4d5e6"
      />
    }
  />

  <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
    <ActionBar ariaLabel="Actions for Jane Doe">
      <Button variant="primary" size="sm" icon="users">
        Compare
      </Button>
      <Button variant="secondary" size="sm" icon="plus">
        Add to Group
      </Button>
    </ActionBar>

    <DetailSection
      title="Group memberships"
      description="Where this access comes from"
      actions={<Badge variant="neutral">14</Badge>}
    >
      {/* ListRows */}
    </DetailSection>

    <CollapsibleSection title="Profile attributes">{/* … */}</CollapsibleSection>
  </div>
</div>
```

Sections are white cards on the canvas: `DetailSection` for something always worth
reading, `CollapsibleSection` for detail worth hiding by default.

### Shape 3 — the Overview

The context-driven landing tab. It has no search and no list of its own: it describes
whatever entity the live Okta tab is showing, and offers the jumps out of it (View
Rules, Export Members, View all groups). Build it as a stack of `DetailSection` cards
under a `PageHeader`, each ending in the action that leaves for another tab. When
nothing is detected, the whole tab is one `EmptyState` — icon `search`, explaining that
navigating to a group or user page in Okta will populate it.

### Every screen has four states

Design them together; a screen is not done with only the loaded one.

| State   | Build it with                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| Loading | `Skeleton` rows inside `ScrollableList`'s `skeleton` slot for a list; `LoadingSpinner` for a single fetch  |
| Empty   | `EmptyState` — always an `icon`, a `title`, a `description`, and where possible one action                 |
| Error   | `AlertMessage` with `message={{ text, type: 'danger' }}` and an `onDismiss`, above the content it concerns |
| Loaded  | the shapes above                                                                                           |

Empty and "no results after filtering" are different screens: the first offers the
action that loads data, the second offers Clear filters.

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
