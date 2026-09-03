import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import GroupsListActionBar from './GroupsListActionBar';

/** The groups-list rung's ADR-0039 action-bar wrapper. */
const meta = {
  title: 'Groups/GroupsListActionBar',
  component: GroupsListActionBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Replaces `GroupSelectionBar`, which laid ten buttons and an `N of M selected` readout ' +
          'out by hand on a `bg-neutral-50` card. That row could not overflow — it wrapped to ' +
          'three lines at 360px, giving *Cleanup* the same standing as *Compare* — and grey is ' +
          "the panel's inert wash, so a slab of controls above a white list read as switched " +
          'off.\n\n' +
          '**Two rows, because there were always two kinds of verb.** The strip declares a ' +
          'page-scoped action row and a selection-scoped `register`, and `ActionBar` renders the ' +
          'second as a recessed well one tonal step below the first — no border, no rule, no ' +
          'divider between them. *Export list* acts on the filter and is present in every state; ' +
          '*Export (3)* acts on the ticked rows and is gone the moment they are unticked. ' +
          'Sharing one row, those two were indistinguishable.\n\n' +
          '**The register shares its space, it does not stack.** It is passed unconditionally, so ' +
          'at rest it still holds *Select all (M)* and is still a row: ticking the first checkbox ' +
          'adds controls to a row that already exists and nothing below the band moves. A ' +
          'register that appeared on the first tick would push the list down under the pointer ' +
          'that was ticking it.\n\n' +
          '**Position one of the register is a safety property.** Every other control there ' +
          'appears and disappears with the selection size, so whatever sits first changes as you ' +
          'tick rows — and the first cut of this strip put *Merge* there, under the pointer that ' +
          'had just been pressing *Select all*. It is *Deselect all* the moment anything is ' +
          'ticked and *Select all* when nothing is, both `pinned` (ADR-0051 §2, untouched by ' +
          'ADR-0061 and ADR-0068).\n\n' +
          '*Merge* and *Bulk actions* start behind **More** on consequence (ADR-0039) — the ' +
          'first empties the source groups, the second deletes memberships across the selection. ' +
          '*Collections* and *Cleanup* are there on frequency alone. *Export (N)* is there under ' +
          'ADR-0068 §2’s flat rule: an export descriptor forwards to the Export tab rather than ' +
          'producing a file in place, so it is never in the row.\n\n' +
          'Selection-scoped verbs are **omitted** below their threshold rather than shipped ' +
          'disabled: *Compare* appears for 2–5 selected, *Export (N)* / *Merge* / *Bulk actions* ' +
          'above 0.\n\n' +
          '**Two controls are deliberately disabled instead, and each says why.** *Export list* ' +
          'acts on the filter, so at zero filtered rows it is a live verb with an empty result. ' +
          '*Select all (M)* stays visible and disabled at a full selection: it does not swap to ' +
          '*Deselect all* and it does not vanish, because a control that disappears at the ' +
          'boundary makes the boundary unreadable and `(M)` is the strip’s only statement of how ' +
          'many rows the filter matches. Both carry the reason in the button’s accessible ' +
          'description rather than restating the label.\n\n' +
          '**The blue button is still *Export list* (ADR-0068 §2, softened).** `primary` marks a ' +
          'verb that *acts* — opens a modal or performs the operation — and this rung has none: ' +
          'the panel toggles are read-only and every verb that writes is selection-scoped. The ' +
          'softened rule admits an export as `primary` on exactly that rung, and only there; a ' +
          'refresh never qualifies, and every other export in the app is `tier`.\n\n' +
          '**A panel toggle is not a verb.** *Cross-search*, *Collections*, *Cleanup* and *Bulk ' +
          'actions* are `ghost` — chromeless beside the bordered `secondary` of a verb — and ' +
          'state themselves in their **label** (*Cross-search (5)* → *Hide cross-search*), never ' +
          'in a colour, an `aria-pressed` or a `className` a descriptor may not carry. An open ' +
          "trigger keeps `priority: 'pinned'` explicitly, which is the half that matters for " +
          'safety: the control that closes a panel must never be the one hiding behind **More**.',
      },
    },
  },
  args: {
    selectedCount: 0,
    filteredCount: 42,
    activePanel: 'none',
    crossSearchBadge: 0,
    onSelectAll: fn(),
    onDeselectAll: fn(),
    onCompare: fn(),
    onMerge: fn(),
    onTogglePanel: fn(),
    onExportSelection: fn(),
    onExportGroupsList: fn(),
  },
  argTypes: {
    selectedCount: { description: 'Number of currently selected groups.' },
    filteredCount: { description: 'Number of groups after filtering.' },
    activePanel: {
      description:
        'Which inline panel is open; its trigger names the way back and is pinned into the row.',
    },
    crossSearchBadge: {
      description: 'Cached-members count — appended to the Cross-search label when above zero.',
    },
    onSelectAll: { description: 'Selects every filtered group.' },
    onDeselectAll: { description: 'Clears the selection.' },
    onCompare: { description: 'Opens the comparison modal (offered only for 2–5 selections).' },
    onMerge: { description: 'Opens the merge wizard (offered for 2+ selections).' },
    onTogglePanel: { description: 'Toggles the given inline panel open/closed.' },
    onExportSelection: { description: 'Exports the selected groups.' },
    onExportGroupsList: { description: 'Exports the current (filtered) groups list.' },
  },
} satisfies Meta<typeof GroupsListActionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The register at rest.
 *
 * It already holds `Select all (42)`, so the first tick adds controls to a row
 * that exists rather than opening a new one under the pointer. No
 * selection-scoped verb is offered yet, not even disabled — a verb with nothing
 * to act on is not a verb (ADR-0039).
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const register = canvas.getByRole('group', { name: 'Selection actions for the groups list' });

    await expect(within(register).getAllByRole('button')).toHaveLength(1);
    await expect(within(register).getByRole('button', { name: 'Select all (42)' })).toBeEnabled();
    await expect(canvas.queryByRole('button', { name: 'Deselect all' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Compare/ })).not.toBeInTheDocument();
  },
};

/**
 * **The safety property, asserted** (ADR-0051 §2): with a selection large enough
 * for *Merge* to exist, the first control **in the register** is still *Deselect
 * all* — never the verb that copies members into a survivor and empties the
 * sources.
 *
 * Scoped to the register rather than to the whole strip, because the strip's
 * first control is now the page row's `primary`, which is constant and is not
 * what the property is about. The register is the row whose contents change as
 * you tick, so it is the row the rule has to hold in.
 */
export const FirstRegisterControlIsAlwaysSelection: Story = {
  args: { selectedCount: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const register = canvas.getByRole('group', { name: 'Selection actions for the groups list' });

    const first = within(register).getAllByRole('button')[0];
    await expect(first).toHaveAccessibleName('Deselect all');
    // Non-vacuity: `Merge` really is on the strip at this selection size — it is
    // just nowhere near position one.
    await expect(canvas.getByRole('button', { name: /^Merge/ })).toBeInTheDocument();
    await expect(
      within(register).queryByRole('button', { name: /^Merge/ }),
    ).not.toBeInTheDocument();
  },
};

/**
 * Three selected — *Compare (3)* joins the register beside the two selection
 * controls; *Merge*, *Bulk actions* and *Export (3)* sit in the tier.
 */
export const WithSelection: Story = {
  args: { selectedCount: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const register = canvas.getByRole('group', { name: 'Selection actions for the groups list' });

    const first = within(register).getAllByRole('button')[0];
    await expect(first).toHaveAccessibleName('Deselect all');
    await expect(within(register).getByRole('button', { name: 'Select all (42)' })).toBeEnabled();
    await expect(within(register).getByRole('button', { name: 'Compare (3)' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Export (3)' })).toBeInTheDocument();
  },
};

/** Twelve selected — past Compare's 2–5 window, so Compare is gone; Merge stays, in the tier. */
export const LargeSelection: Story = {
  args: { selectedCount: 12 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: /^Compare/ })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Merge (12)' })).toBeInTheDocument();
  },
};

/** Cached cross-group results are carried in the label, since a descriptor has no badge slot. */
export const WithCachedCrossSearch: Story = {
  args: { selectedCount: 3, crossSearchBadge: 5 },
};

/**
 * Bulk panel open — a tier verb pulled into the row, so the control that closes it
 * is there, and saying so in words rather than in a colour (ADR-0061).
 */
export const BulkPanelOpen: Story = {
  args: { selectedCount: 4, activePanel: 'bulk' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Hide bulk actions' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Bulk actions' })).not.toBeInTheDocument();
  },
};

/**
 * The open panel says so, and the blue button does not move.
 *
 * This strip used to mark its open panel with `variant: 'primary'`, which is
 * colour-only state — a screen reader was told nothing, and the rung's one blue
 * button meant "a panel is open" rather than "start here". The open trigger now
 * states itself in its label and keeps `priority: 'pinned'` explicitly, which is
 * the half that matters for safety: the control that closes a panel can never be
 * the one hiding behind **More**.
 */
export const TheOpenPanelSaysSo: Story = {
  args: { activePanel: 'crossSearch', crossSearchBadge: 5 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Hide cross-search' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Cross-search/ })).not.toBeInTheDocument();
    // The page verb is unaffected by which panel is open.
    await expect(canvas.getByRole('button', { name: 'Export list' })).toBeInTheDocument();
  },
};

/**
 * The rung's `primary`, and why an export is allowed to be one *here* (ADR-0068
 * §2, softened).
 *
 * `primary` marks a verb that **acts** — its object is the whole page *and*
 * pressing it opens a modal or performs the operation. This rung has none:
 * *Cross-search*, *Collections* and *Cleanup* open read-only panels, and every
 * verb that writes is scoped to a selection, so it belongs to what you ticked
 * rather than to the page and is absent until something is. The softened rule
 * admits an export on exactly that rung — never a refresh, and never anywhere an
 * acting verb exists to displace.
 *
 * *Export list* is present in every state, which is what a `primary` has to be,
 * and `primary` implies `pinned`, so it never overflows behind **More**. Every
 * other export in the app, *Export (N)* below included, is `tier`.
 *
 * Which button is blue is **not** asserted here and cannot be: the headless
 * runner loads no Tailwind, so `variant` has no visible consequence to check.
 * What is asserted is the arrangement — present in every state, never in the
 * register, never overflowed.
 */
export const ExportListIsTheRungsPrimary: Story = {
  args: { selectedCount: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const exportList = canvas.getByRole('button', { name: 'Export list' });
    // Present with a selection too — a page verb does not come and go with rows.
    await expect(exportList).toBeEnabled();

    // And it is a page verb, so it is never in the selection register.
    const register = canvas.getByRole('group', { name: 'Selection actions for the groups list' });
    await expect(
      within(register).queryByRole('button', { name: 'Export list' }),
    ).not.toBeInTheDocument();
  },
};

/**
 * Cleanup open. It rests behind **More** (`priority: 'tier'`) because it is the
 * rarest verb here, and is pulled into the row only while its panel is open.
 */
export const CleanupPanelOpen: Story = {
  args: { activePanel: 'cleanup' },
};

/**
 * Everything taken — *Select all* stays for its count, disabled, and says why.
 *
 * It does **not** swap to *Deselect all* and it does not disappear: a control
 * that vanishes at the boundary makes the boundary unreadable, and `(M)` is this
 * strip's only statement of how many rows the filter matches. A disabled control
 * with no explanation is worse than an enabled one, so the reason is the button's
 * accessible description — which of the two boundaries it is standing on, not a
 * restatement of its label.
 */
export const AllSelected: Story = {
  args: { selectedCount: 42 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const register = canvas.getByRole('group', { name: 'Selection actions for the groups list' });
    await expect(within(register).getAllByRole('button')[0]).toHaveAccessibleName('Deselect all');

    const selectAll = canvas.getByRole('button', { name: 'Select all (42)' });
    await expect(selectAll).toBeDisabled();
    await expect(selectAll).toHaveAccessibleDescription(
      'All 42 groups matching the filter are already selected',
    );
    // The way out is a separate, live control — not this one under another name.
    await expect(canvas.getByRole('button', { name: 'Deselect all' })).toBeEnabled();
  },
};

/**
 * Nothing matches the filter — both deliberately-disabled controls stay, and the
 * two say different things, because they are sitting on different boundaries.
 */
export const NoFilteredGroups: Story = {
  args: { filteredCount: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const exportList = canvas.getByRole('button', { name: 'Export list' });
    await expect(exportList).toBeDisabled();
    await expect(exportList).toHaveAccessibleDescription(
      'No groups match the current filter, so there is nothing to export',
    );

    const selectAll = canvas.getByRole('button', { name: 'Select all (0)' });
    await expect(selectAll).toBeDisabled();
    await expect(selectAll).toHaveAccessibleDescription('No groups match the current filter');
  },
};
