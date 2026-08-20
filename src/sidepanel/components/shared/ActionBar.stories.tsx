import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement, ReactNode } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import ActionBar from './ActionBar';
import Button from './Button';
import DetailSection from './DetailSection';
import EntityIdentity from './EntityIdentity';
import PageHeader from './PageHeader';

/**
 * The page-level action strip of a detail view: a pill that hugs its verbs, widens
 * into the header as it docks, and moves whatever no longer fits behind **More**.
 */
const meta = {
  title: 'Shared/ActionBar',
  component: ActionBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The rule this enforces: **a verb whose object is the whole page belongs here; a verb scoped to one section's data belongs in that section's `DetailSection.actions` slot.**\n\n" +
          'Before this existed, "Compare" sat in the group-memberships card header — structurally indistinguishable from "Add to group", which acts on that card alone — so the page\'s most important action read as a property of one section.\n\n' +
          '**Actions are data, not children.** The strip takes `ActionDescriptor[]` rather than `Button` children, because a strip that cannot see what it holds cannot decide what fits. With descriptors it measures each action once and re-splits the row as the panel is dragged: everything on a wide panel, icons dropped when it tightens, the tail behind **More** when it tightens further. `shared/actionBarFit` does the arithmetic and `shared/useActionOverflow` does the measuring; this component only renders their answer. The price is that a descriptor can carry no JSX — an arbitrary node cannot be measured from a cached width, nor re-rendered into the tier with different chrome. Arbitrary UI goes in `expansion`, which is the whole point of that slot.\n\n' +
          "**A pill at rest, a band once docked.** The strip hugs its actions rather than spanning the column: a two-verb strip is two verbs wide. Reaching its parking spot is not the same as looking parked, so over the last `--merge-range` (16px of travel) before it docks it widens to the panel edges, drops its radius and its top and side borders, covers the header's bottom seam and grows a shadow — header and strip end up one continuous pinned surface. The hug is **painted, not laid out**: the band keeps its full layout width and only its chrome stops at the last button. That is what lets the overflow observer watch a width that never churns, and it is why the leading buttons hold still through the whole merge. The one exception is the trailing **More** cluster, which rides the widening edge.\n\n" +
          '**The cramped ladder: icons first, then overflow.** When the row tightens, every bar action drops its glyph — globally, never per action, because a row with some icons and some without reads as broken. Only when the bare labels still do not fit does the tail move into the tier, last-declared first. A `pinned` action never leaves the bar, and a `primary` action is pinned by default.\n\n' +
          '**The tier is a region, not a menu.** What sits behind **More** is a second row inside the band: it stretches the strip downward through the shared `.disclose` grid instead of dropping a card into the flow beneath it, and it shares the strip\'s chrome and its merge. It holds two things, in order — the actions that did not fit, which the strip owns and the caller never sees, and then `expansion` verbatim, be that an account-state block, a form, or anything else. That second half is exactly why it is a disclosure region rather than a `role="menu"` popover: a menu may contain menu items and nothing else, which would forbid the arbitrary UI this slot exists for. Its children stay mounted while closed, held out of the tab order and the accessible tree with `inert`.\n\n' +
          '**Why it sticks:** the side panel has exactly one scroller, the `overflow-y-auto` app root, which `TabPanel` shares and which the Users tab does not shadow with a scroll box of its own. The strip is the third band of the sticky stack (ADR-0032), parking below the tab rail and the page header rather than at the top of the scroller.\n\n' +
          'The merge is driven by a CSS scroll-driven animation on a zero-size view-timeline sentinel rendered just before the strip, so it tracks *distance to the header* rather than raw scroll offset, with no per-frame JavaScript on the shared scroller. Anchoring it to scroll offset instead is visibly wrong: a strip that starts partway down a long rung finishes merging while it is still floating mid-page.\n\n' +
          'Related internals: `shared/actionBarFit`, `shared/useActionOverflow`, `shared/DetailSection`, `shared/PageHeader`, `shared/CollapsibleSection`.',
      },
    },
  },
  argTypes: {
    actions: {
      description:
        'The page\'s verbs as data, ordered by weight. Exactly one `variant="primary"`; the rest `secondary`. Order matters twice: it is the reading order, and the tail is what overflows first. `priority` defaults to `flex` (`pinned` for a `primary` action); `tier` keeps an action behind **More** from the start.',
    },
    ariaLabel: {
      description:
        'Accessible name for the group, e.g. `"Actions for Jane Doe"`. Required — a bare group of buttons announces nothing about what it acts on.',
    },
    sticky: {
      description:
        'Pin below the tab rail and the page header while the page scrolls under it, merging into the header as it docks. Defaults to `true`; pass `false` in an already-fixed region, which also opts out of the merge (the strip then simply keeps its resting pill).',
    },
    expansion: {
      description:
        'Arbitrary caller UI for the tier, appended below anything that overflowed there. Inside the strip, not a sibling card — it shares the chrome and docks with it. A block that merely *follows* the strip on the page is a `DetailSection`, not this.',
    },
    tierOpen: {
      description:
        'Whether the tier is open. Omit to let the strip own the state — the tier can become non-empty without the caller knowing, so a caller that never passed `expansion` should not have to own state for it.',
    },
    defaultTierOpen: { description: 'Initial open state when uncontrolled. Defaults to `false`.' },
    onTierOpenChange: {
      description: 'Called with the next open state whenever the disclosure is toggled.',
    },
    className: { description: 'Extra classes merged after the layout classes.' },
    testId: { description: 'Optional test handle.' },
  },
  args: {
    ariaLabel: 'Actions for Jane Doe',
    sticky: false,
    actions: [
      { id: 'add-group', label: 'Add group', icon: 'plus', variant: 'primary', onClick: fn() },
      { id: 'compare', label: 'Compare', icon: 'users', onClick: fn() },
      { id: 'export', label: 'Export', icon: 'download', onClick: fn() },
    ],
  },
} satisfies Meta<typeof ActionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Wait for the strip to be showing a *measured* split.
 *
 * The first render deliberately puts every action in the bar — that is the
 * no-measurement fallback, and it is also what jsdom and any engine without a
 * `ResizeObserver` see — so an assertion that lands before the measure pass has
 * run proves nothing. The pass itself is synchronous before paint, but the hook
 * re-takes every width once the web font lands (Inter is `font-display: swap`,
 * so pre-swap labels are wrong by several pixels each). Its `fonts.ready`
 * callback is registered at mount, ahead of this one, so awaiting the same
 * promise puts us behind it; the frames then let that re-render and its layout
 * effect commit. This synchronises — it never asserts.
 */
const settle = async (): Promise<void> => {
  await document.fonts.ready;
  await new Promise(window.requestAnimationFrame);
  await new Promise(window.requestAnimationFrame);
};

/**
 * The labels of the buttons that are in the **bar**, as opposed to behind **More**.
 *
 * The disclosure's `aria-controls` is the component's public statement of which
 * region is the tier, so it — not a class name and not a DOM path — is what
 * tells an action in the row apart from one that overflowed. With no **More**
 * control there is no tier, and every button is a bar button.
 */
const barButtonLabels = (canvasElement: HTMLElement): string[] => {
  const canvas = within(canvasElement);
  const more = canvas.queryByRole('button', { name: 'More' });
  const tierId = more?.getAttribute('aria-controls');
  const tier = tierId ? canvasElement.ownerDocument.getElementById(tierId) : null;
  return canvas
    .getAllByRole('button')
    .filter((button) => tier === null || !tier.contains(button))
    .map((button) => (button.textContent ?? '').trim());
};

/**
 * A frame that pins the strip to the side panel's 360px floor.
 *
 * The width is an inline `inline-size` rather than a `w-[360px]` utility, and the
 * `viewport` parameter on these stories is for the explorer alone. Neither is a
 * style preference. The headless story suite — `vitest.config.ts`'s `storybook`
 * project — builds without `@tailwindcss/vite`, because only the explorer's
 * dev/build server merges the app's `vite.config.ts`, so **no application CSS is
 * loaded when a story runs as a test**. A utility class constrains nothing there,
 * and the viewport presets only resize the explorer's preview
 * (`docs/component-explorer.md`). An inline declaration is the one width that
 * bites in both places, which is what a story asserting a measured split needs.
 *
 * The labels in those stories are long for the same reason: an unstyled button
 * carries no padding, so the run has to be comfortably wider than the frame in
 * *both* layouts for the overflow to be a real consequence rather than an
 * accident of whichever one the assertion happened to land in.
 */
const narrowFrame = (strip: ReactNode): ReactElement => (
  <div className="bg-canvas p-3" style={{ inlineSize: '360px' }}>
    {strip}
  </div>
);

/** The user-detail set: add to a group, compare, export. */
export const Default: Story = {};

/**
 * A single verb — the group-detail case, and the one shape that renders **no More
 * control at all**: one action with no caller `expansion` leaves the tier empty,
 * and an `aria-expanded` button pointing at an empty region is an a11y defect,
 * not a courtesy.
 *
 * It is also why the chrome is transparent at rest here. A `rounded-md` button
 * inside a `rounded-md` pill with 8px of padding is concentric radii, which
 * always read wrong, so the strip *is* the button until it docks — the
 * background and border fade in as the merge widens it into a bar.
 */
export const SingleAction: Story = {
  args: {
    ariaLabel: 'Actions for Sales — West',
    actions: [{ id: 'export-members', label: 'Export members', icon: 'download', onClick: fn() }],
  },
};

/**
 * At 360px — the panel's real floor — the strip walks the cramped ladder instead of
 * wrapping: the glyphs go first, all of them at once, and only then does the tail
 * move behind **More**. Drag the frame wider in the explorer to watch it climb back.
 */
export const AtPanelWidth: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
  render: (args) => narrowFrame(<ActionBar {...args} />),
};

/**
 * The real detail-rung composition: a sticky `PageHeader` above, the strip below it, sections
 * scrolling underneath. Scroll the frame to watch the strip **merge into the header** — over
 * the last `--merge-range` (16px) before it parks it widens from its resting pill out to the
 * panel edges, drops its radius and its top/side borders, covers the header's bottom seam and
 * grows a shadow, so the two become one continuous pinned surface.
 *
 * The buttons do not move: only the chrome behind them does — with one exception. The trailing
 * **More** cluster rides the widening edge out to the panel's right margin, because a
 * disclosure stranded 200px short of the edge of a full-bleed band reads as a stray verb. The
 * leading buttons are the ones that must hold still, and they do: the hug is painted rather
 * than laid out, so nothing in flow is on the timeline.
 *
 * Note *when* it happens: nothing changes until the strip is nearly home, and it is fully
 * merged the instant it stops. Measured in Chromium at a 420px viewport, it rests unmerged
 * through the first ~7px of scroll, merges over the next ~17, and hits 100% on exactly the
 * frame it parks. 16px, not 64: the range is bounded by the gap the strip closes — the
 * column's `py-6` — and the old value was nearly three times that, so the strip began life
 * 61% merged and could never show its resting shape at all.
 *
 * A motion showcase, so it opts back into motion (`parameters: { motion: 'on' }`) — there is
 * nothing to see with `data-motion="off"`. That off state is not a rendering artefact: a
 * scroll-driven animation cannot be shortened to `1ms` the way a timed one can, so reduced
 * motion clears its `animation-name` instead and the strip simply keeps its resting pill.
 * Flip the toolbar's motion control to see exactly what a `prefers-reduced-motion` user gets.
 */
export const StickyInAScroller: Story = {
  parameters: { motion: 'on' },
  args: {
    sticky: true,
    // A tier, because the rung this mirrors has one: `UserActionBar` keeps the
    // account-state verbs behind **More**. Without it there is no More cluster in
    // the DOM at all, and the docstring below would be describing travel that this
    // story could not show — measured `--dock-more-travel: 0px` while the stories
    // that do have a cluster published 546px and 11px.
    actions: [
      { id: 'add-group', label: 'Add group', icon: 'plus', variant: 'primary', onClick: fn() },
      { id: 'compare', label: 'Compare', icon: 'users', onClick: fn() },
    ],
    expansion: (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" icon="pause" onClick={fn()}>
          Suspend user
        </Button>
        <Button variant="secondary" size="sm" icon="key" onClick={fn()}>
          Reset password
        </Button>
      </div>
    ),
  },
  render: (args) => (
    // `[overflow-anchor:none]` mirrors the app's scroll root (`App.tsx`). Without it,
    // Chrome's scroll anchoring fights the pinned header's identity collapse and drags
    // `scrollTop` back to 0 on every small scroll — see ADR-0032.
    <div
      data-header-scope
      className="h-96 w-[360px] overflow-y-auto [overflow-anchor:none] bg-canvas"
    >
      <PageHeader
        sticky
        title="Jane Doe"
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
      />
      <div className="space-y-6 px-6 py-6">
        <ActionBar {...args} />
        {['Membership source', 'Rules', 'Grants access to', 'App push', 'Metadata'].map((title) => (
          <DetailSection key={title} title={title}>
            <p className="text-sm text-neutral-600">
              Body content, tall enough that the strip above has something to hold against.
            </p>
          </DetailSection>
        ))}
      </div>
    </div>
  ),
};

/**
 * The tiered strip: everyday verbs in tier 1, a disclosure below them. Toggle **More** and
 * the strip *stretches* — the row opens inside the band, under the same chrome, so it reads as
 * the control growing rather than as a card arriving underneath it. The buttons hold still,
 * because sticky pins the box's top edge and the row grows away from them.
 *
 * The control is the strip's own, sitting in its own trailing region behind a hairline: it is
 * a `ghost` **More** with a rotating chevron, not a peer verb the caller writes. The tier is
 * uncontrolled by default, because a resize can overflow an action into it without the caller
 * ever knowing — pass `tierOpen`/`onTierOpenChange` only when the page needs to close it
 * itself, as `UsersTab` does on a rung change.
 *
 * The tier stays mounted while closed (`inert`), so nothing inside it resets on collapse.
 */
export const WithExpansion: Story = {
  parameters: { motion: 'on' },
  args: {
    actions: [
      { id: 'add-group', label: 'Add group', icon: 'plus', variant: 'primary', onClick: fn() },
      { id: 'compare', label: 'Compare', icon: 'users', onClick: fn() },
    ],
    expansion: (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" icon="pause" onClick={fn()}>
          Suspend user
        </Button>
        <Button variant="secondary" size="sm" icon="key" onClick={fn()}>
          Reset password
        </Button>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const more = canvas.getByRole('button', { name: 'More' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByRole('button', { name: 'Suspend user' })).toBeVisible();
  },
};

/**
 * Six verbs in a panel too narrow to hold them. Dropping every glyph is not enough room
 * here, so the tail of the run moves behind **More** — last-declared first, which is why
 * `Clear sessions` is the one that leaves and `Add to group` is not.
 *
 * This and `PinnedNeverOverflows` are the two stories that assert a *measured* consequence,
 * so their width has to survive an environment with no stylesheet — which is what
 * `narrowFrame` above is for, and why the labels are longer here than elsewhere.
 */
export const Overflows: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
  args: {
    ariaLabel: 'Actions for Jane Doe',
    actions: [
      { id: 'add-group', label: 'Add to group', icon: 'plus', onClick: fn() },
      { id: 'compare', label: 'Compare users', icon: 'users', onClick: fn() },
      { id: 'export', label: 'Export members', icon: 'download', onClick: fn() },
      { id: 'refresh', label: 'Refresh access', icon: 'refresh', onClick: fn() },
      { id: 'deactivate', label: 'Deactivate user', icon: 'pause', onClick: fn() },
      { id: 'clear-sessions', label: 'Clear sessions', icon: 'key', onClick: fn() },
    ],
  },
  render: (args) => narrowFrame(<ActionBar {...args} />),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await settle();

    const more = await canvas.findByRole('button', { name: 'More' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(barButtonLabels(canvasElement)).not.toContain('Clear sessions'));

    // Closed, the tier is held out of the tab order with `inert`, so what
    // overflowed cannot be reached at all — not merely not seen.
    const overflowed = canvas.getByRole('button', { name: 'Clear sessions' });
    overflowed.focus();
    await expect(overflowed).not.toHaveFocus();

    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'true');

    const reachable = canvas.getByRole('button', { name: 'Clear sessions' });
    reachable.focus();
    await expect(reachable).toHaveFocus();
  },
};

/**
 * The rung below overflow. At 370px in the explorer these four verbs do not fit with their
 * glyphs but do without them, so the strip drops every icon and keeps all four rather than
 * pushing one away. Icons go all at once: a row with some icons and some without reads as broken, not
 * as adaptive.
 *
 * **Visual only — no `play`, so this is not a test.** The icon rung is the one step of the
 * ladder that cannot be asserted honestly from a story. Its visible consequence is a missing
 * glyph, and asserting that means reaching for classes or DOM internals (ADR-0023). Its
 * *behavioural* consequence — "nothing overflowed" — is indistinguishable from the
 * pre-measurement first render, and in the headless suite (where no stylesheet is loaded, so
 * a glyph costs nothing) it is true for the wrong reason. `actionBarFit.test.ts` owns this
 * rung: it is the `full === n` branch, table-driven and measured in numbers rather than
 * pixels.
 */
export const IconsDropBeforeOverflow: Story = {
  args: {
    ariaLabel: 'Actions for Jane Doe',
    actions: [
      { id: 'add-group', label: 'Add group', icon: 'plus', onClick: fn() },
      { id: 'compare', label: 'Compare', icon: 'users', onClick: fn() },
      { id: 'export', label: 'Export', icon: 'download', onClick: fn() },
      { id: 'refresh', label: 'Refresh', icon: 'refresh', onClick: fn() },
    ],
  },
  render: (args) => (
    <div className="w-[370px] bg-canvas p-3">
      <ActionBar {...args} />
    </div>
  ),
};

/**
 * `pinned` is the floor the ladder stops at. `Add to group` is the page's primary verb, so
 * it is pinned by default and stays in the bar at any width — the row would wrap before it
 * left. Everything behind it is `flex` and overflows from the tail, so the same width that
 * pushes `Deactivate user` behind **More** leaves the primary exactly where it was.
 */
export const PinnedNeverOverflows: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
  args: {
    ariaLabel: 'Actions for Jane Doe',
    actions: [
      { id: 'add-group', label: 'Add to group', icon: 'plus', variant: 'primary', onClick: fn() },
      { id: 'compare', label: 'Compare users', icon: 'users', onClick: fn() },
      { id: 'export', label: 'Export members', icon: 'download', onClick: fn() },
      { id: 'refresh', label: 'Refresh access', icon: 'refresh', onClick: fn() },
      { id: 'deactivate', label: 'Deactivate user', icon: 'pause', onClick: fn() },
    ],
  },
  render: (args) => narrowFrame(<ActionBar {...args} />),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await settle();

    const more = await canvas.findByRole('button', { name: 'More' });
    // Something has to have left, or "the primary stayed" says nothing at all.
    await waitFor(() => expect(barButtonLabels(canvasElement)).not.toContain('Deactivate user'));
    await expect(barButtonLabels(canvasElement)).toContain('Add to group');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
  },
};

/**
 * The tier's two halves at once: the verbs the strip put there, then a separator, then the
 * caller's own UI verbatim. The strip owns the first half and the caller never sees it; the
 * second half is arbitrary JSX, which is the reason this is a disclosure region rather than
 * a `role="menu"` popover — a menu may hold menu items and nothing else, and an
 * account-state block is not a menu item.
 *
 * `Clear sessions` is declared `priority: 'tier'`, which is how a caller says "this verb
 * belongs behind More whatever the panel width is". It also makes the composition
 * *deterministic*: the same two halves render on a 1400px display, so the assertion below is
 * about what the tier holds rather than about how wide the canvas happened to be. The rest
 * of the run is ordinary `flex`, so in the explorer at 360px it is joined there by whatever
 * genuinely overflowed.
 */
export const TierHoldsOverflowAndCustomContent: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
  args: {
    ariaLabel: 'Actions for Jane Doe',
    actions: [
      { id: 'add-group', label: 'Add to group', icon: 'plus', variant: 'primary', onClick: fn() },
      { id: 'compare', label: 'Compare users', icon: 'users', onClick: fn() },
      { id: 'export', label: 'Export members', icon: 'download', onClick: fn() },
      { id: 'refresh', label: 'Refresh access', icon: 'refresh', onClick: fn() },
      {
        id: 'clear-sessions',
        label: 'Clear sessions',
        icon: 'key',
        priority: 'tier',
        onClick: fn(),
      },
    ],
    expansion: (
      <div className="space-y-2">
        <p className="text-xs text-neutral-600">
          Password last changed 12 Mar 2026 · jane.doe@example.com
        </p>
        <Button variant="secondary" size="sm" icon="key" onClick={fn()}>
          Reset password
        </Button>
      </div>
    ),
  },
  render: (args) => narrowFrame(<ActionBar {...args} />),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const more = canvas.getByRole('button', { name: 'More' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(barButtonLabels(canvasElement)).not.toContain('Clear sessions');

    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'true');

    // Both halves live in the one region the disclosure names.
    const tierId = more.getAttribute('aria-controls') ?? '';
    const tier = within(canvasElement.ownerDocument.getElementById(tierId) as HTMLElement);
    await expect(tier.getByRole('button', { name: 'Clear sessions' })).toBeVisible();
    await expect(tier.getByRole('button', { name: 'Reset password' })).toBeVisible();
  },
};
/**
 * The resting shape, next to something that really is column-width. A `DetailSection` spans
 * the rung; the strip above it does not — it is exactly as wide as the verbs it holds. That
 * difference is the whole point of the hug, and it is what the merge spends its last 32px of
 * travel erasing.
 *
 * **Visual only — no `play`, so this is not a test.** It renders (which the browser suite and
 * its axe run do check), and nothing more. The behavioural claims live in `Overflows`,
 * `IconsDropBeforeOverflow`, `PinnedNeverOverflows` and
 * `TierHoldsOverflowAndCustomContent`.
 */
export const HugAtRest: Story = {
  args: {
    actions: [
      { id: 'add-group', label: 'Add group', icon: 'plus', variant: 'primary', onClick: fn() },
      { id: 'compare', label: 'Compare', icon: 'users', onClick: fn() },
    ],
  },
  render: (args) => (
    <div className="w-[480px] space-y-6 bg-canvas p-6">
      <ActionBar {...args} />
      <DetailSection title="Membership source">
        <p className="text-sm text-neutral-600">
          A section fills the column edge to edge. The strip above it stops at its last button, and
          only grows into a band as it docks.
        </p>
      </DetailSection>
    </div>
  ),
};
