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
          '**Position one is a safety property.** Every other verb appears and disappears with ' +
          'the selection size, so whatever sits first changes as you tick rows — and the first ' +
          'cut of this strip put *Merge* there, under the pointer that had just been pressing ' +
          '*Select all*. It is now *Deselect all* the moment anything is ticked and *Select all* ' +
          'when nothing is, both `pinned`.\n\n' +
          '*Merge* and *Bulk actions* start behind **More** on consequence (ADR-0039) — the ' +
          'first empties the source groups, the second deletes memberships across the selection. ' +
          '*Cleanup* is there on frequency alone.\n\n' +
          'Selection-scoped verbs are **omitted** below their threshold rather than shipped ' +
          'disabled: *Compare* appears for 2–5 selected, *Export (N)* / *Merge* / *Bulk actions* ' +
          'above 0. *Export list* is the one deliberate disabled state — it acts on the filter, ' +
          'not the selection, so at zero filtered rows it is a live verb with an empty result.\n\n' +
          'The counts moved into the verbs that need them.\n\n' +
          '**The blue button is *Export list*, and that is a decision (ADR-0061, I-030).** With ' +
          'no panel open — the state this rung rests in — every control here was `secondary`, so ' +
          'six identically-weighted buttons sat above the list with nothing saying where to ' +
          'start. `primary` names a rung’s *page-level verb*, and *Export list* is the only ' +
          'candidate: every other verb is scoped to a selection and absent until one exists, ' +
          'while this one acts on the whole filtered rung and is present in every state. The ' +
          'Rules strip’s answer — a *Load* / *Refresh* verb — is not available here, because the ' +
          'Groups list loads on arrival.\n\n' +
          '**The open panel says so in words.** It used to be marked with ' +
          "`variant: 'primary'`, which is colour-only state a screen reader is told nothing " +
          'about. The trigger now swaps its label (*Cross-search (5)* → *Hide cross-search*) and ' +
          "keeps `priority: 'pinned'` explicitly — the half that matters for safety, since the " +
          'control that closes a panel must never be the one hiding behind **More**.',
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

/** Nothing selected — no selection-scoped verb is offered, not even disabled. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: /^Merge/ })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Compare/ })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Select all (42)' })).toBeEnabled();
    await expect(canvas.queryByRole('button', { name: 'Deselect all' })).not.toBeInTheDocument();
  },
};

/**
 * The safety property, asserted: with a selection large enough for *Merge* to
 * exist, the strip's first control is still *Deselect all* — never the verb that
 * empties groups.
 */
export const FirstControlIsAlwaysSelection: Story = {
  args: { selectedCount: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = canvas.getAllByRole('button')[0];
    await expect(first).toHaveAccessibleName('Deselect all');
    await expect(canvas.getByRole('button', { name: /^Merge/ })).toBeInTheDocument();
  },
};

/** Three selected — Compare and Export (3) join the row; Merge and Bulk sit in the tier. */
export const WithSelection: Story = {
  args: { selectedCount: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Compare (3)' })).toBeInTheDocument();
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
 * The rung's page-level verb, and the reason this strip has a `primary` at all
 * (I-030).
 *
 * *Export list* is the only verb here whose object is the page: every other one —
 * *Compare (N)*, *Merge (N)*, *Export (N)*, *Bulk actions* — is scoped to a
 * selection and absent until one exists. It is present in every state, which is
 * what a `primary` has to be, and `primary` implies `pinned`, so it never
 * overflows behind **More**.
 */
export const ExportListIsThePageVerb: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const exportList = canvas.getByRole('button', { name: 'Export list' });
    await expect(exportList).toBeInTheDocument();
    // Present with a selection too — a page verb does not come and go with rows.
    await expect(exportList).toBeEnabled();
  },
};

/**
 * Cleanup open. It rests behind **More** (`priority: 'tier'`) because it is the
 * rarest verb here, and is pulled into the row only while its panel is open.
 */
export const CleanupPanelOpen: Story = {
  args: { activePanel: 'cleanup' },
};

/** Everything taken — Select all stays for its count, disabled; Deselect all leads. */
export const AllSelected: Story = {
  args: { selectedCount: 42 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('button')[0]).toHaveAccessibleName('Deselect all');
    await expect(canvas.getByRole('button', { name: 'Select all (42)' })).toBeDisabled();
  },
};

/** Nothing matches the filter — Export list is the one verb that stays, disabled. */
export const NoFilteredGroups: Story = {
  args: { filteredCount: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Export list' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Select all (0)' })).toBeDisabled();
  },
};
