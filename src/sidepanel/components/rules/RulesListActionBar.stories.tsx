import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import RulesListActionBar from './RulesListActionBar';
import RulesSearchRow from './RulesSearchRow';

/** The rules-list rung's ADR-0039 action-bar wrapper. */
const meta = {
  title: 'Rules/RulesListActionBar',
  component: RulesListActionBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Rules rung was the last major list rung with no `ActionBar`. It stacked four ' +
          'always-on cards between the header and the first rule, then a toolbar card, then the ' +
          'list — and nothing docked, so all of it scrolled away together. The three analysis ' +
          'cards are now panels this strip toggles, the search field is its `subRow`, and the ' +
          'filter chips live behind that field.\n\n' +
          '**Where `primary` goes (ADR-0059).** ADR-0051 spends `primary` on which inline panel ' +
          'is open, reasoning that a list rung has no page-level verb. This rung is the ' +
          'counter-example: rules do not load on mount, so **Load rules** / **Refresh** is the ' +
          'one thing that has to happen before the rung means anything. It takes `primary` here, ' +
          'and the open panel states itself in its own **label** (`Duplicates (3)` → `Hide ' +
          'duplicates`) rather than in a colour a screen reader cannot read.\n\n' +
          '**All three panel toggles start behind More**, on frequency — the bounded second ' +
          'reason ADR-0051 §2 allows, which may move a verb down but never up. Nothing on this ' +
          'strip fails the consequence test.\n\n' +
          '**No verb without an object.** No duplicate clusters, no *Duplicates*; no loaded ' +
          'rules, no *Stats*. *This group* is the careful case: its object is the **detected ' +
          'group**, not the relation count, because "no loaded rule assigns users to this group" ' +
          'is the most interesting answer the panel gives — so the verb appears whenever a group ' +
          'is in context, and the count rides the label only when there is one.',
      },
    },
  },
  args: {
    hasRules: true,
    isLoading: false,
    onLoad: fn(),
    duplicateClusterCount: 3,
    hasCurrentGroup: true,
    currentGroupRelationCount: 2,
    activePanel: 'none',
    onTogglePanel: fn(),
    onExportRules: fn(),
    search: (
      <RulesSearchRow
        searchQuery=""
        onSearchChange={fn()}
        filtersOpen={false}
        onToggleFilters={fn()}
        activeFilterCount={0}
      />
    ),
  },
  argTypes: {
    hasRules: { description: 'Whether any rules are loaded — decides Load rules vs Refresh.' },
    isLoading: { description: 'Whether a load is in flight.' },
    onLoad: { description: 'Loads (or reloads) the rules.' },
    duplicateClusterCount: { description: 'Duplicate-condition clusters found. 0 omits the verb.' },
    hasCurrentGroup: { description: 'Whether a group is detected — what This group acts on.' },
    currentGroupRelationCount: { description: 'Distinct related rules. Rides the label above 0.' },
    activePanel: { description: 'Which panel is open; its trigger says Hide … and is pinned.' },
    onTogglePanel: { description: 'Toggles the given panel open/closed.' },
    onExportRules: { description: 'Opens the Export tab on the Group Rules descriptor.' },
    search: { description: "The rung's search row, rendered inside the band beneath the verbs." },
  },
} satisfies Meta<typeof RulesListActionBar>;

/**
 * Open the **More** tier before asserting anything about what is or is not in it.
 *
 * `ActionBar` keeps the tier mounted while closed and holds it out of the accessible
 * tree with `inert`, so a `queryByRole(...).not.toBeInTheDocument()` against a *closed*
 * tier passes whether the verb is absent or merely hidden — it proves nothing. Every
 * assertion below about a tier verb goes through here first.
 */
const openTier = async (canvas: ReturnType<typeof within>): Promise<void> => {
  const more = canvas.queryByRole('button', { name: 'More' });
  if (more && more.getAttribute('aria-expanded') !== 'true') await userEvent.click(more);
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The loaded rung. **Refresh** is the row's `primary`; the three analysis verbs rest
 * behind **More**.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Export rules' })).toBeInTheDocument();
  },
};

/**
 * Nothing loaded yet. The verb names the thing that has to happen first, and every
 * panel toggle is gone — there is nothing to analyse and nothing to search.
 */
export const NothingLoaded: Story = {
  args: {
    hasRules: false,
    duplicateClusterCount: 0,
    currentGroupRelationCount: 0,
    search: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Load rules' })).toBeInTheDocument();
    // No tier at all: with every panel verb omitted there is nothing to disclose.
    await expect(canvas.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Stats/ })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Duplicates/ })).not.toBeInTheDocument();
  },
};

/** A load in flight: the page verb is the only thing that can be busy. */
export const Loading: Story = {
  args: { isLoading: true },
};

/**
 * The ADR-0059 assertion. Opening a panel changes what the control **says**, not just
 * how it is painted — so the state survives a screen reader, and the closer is pulled
 * into the row where it cannot hide behind **More**.
 */
export const TheOpenPanelSaysSo: Story = {
  args: { activePanel: 'duplicates' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Pinned into the row while open, so the control that closes the panel can never be
    // the thing hiding behind More.
    await expect(canvas.getByRole('button', { name: 'Hide duplicates' })).toBeInTheDocument();
    await openTier(canvas);
    await expect(canvas.queryByRole('button', { name: /^Duplicates/ })).not.toBeInTheDocument();
  },
};

/** The current-group panel open, with its own label swap. */
export const CurrentGroupPanelOpen: Story = {
  args: { activePanel: 'currentGroup' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Hide this group' })).toBeInTheDocument();
  },
};

/** The stats panel open. */
export const StatsPanelOpen: Story = {
  args: { activePanel: 'stats' },
};

/**
 * No duplicates found. *Duplicates* is **omitted**, not disabled — a verb with nothing
 * to act on is not a verb yet (ADR-0051 §3).
 */
export const NoDuplicates: Story = {
  args: { duplicateClusterCount: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openTier(canvas);
    await expect(canvas.queryByRole('button', { name: /^Duplicates/ })).not.toBeInTheDocument();
    // The sibling verbs are still there — proving the tier really did open, so the
    // absence above is an absence and not a closed disclosure.
    await expect(canvas.getByRole('button', { name: /^This group/ })).toBeInTheDocument();
  },
};

/**
 * A group is in context but nothing relates to it. The verb **stays** — unlabelled by a
 * count, because there is none to state — since "no loaded rule assigns users to this
 * group" is a finding, and gating the verb on a non-zero count would hide it exactly
 * when there is something to see.
 */
export const CurrentGroupWithNoRelations: Story = {
  args: { currentGroupRelationCount: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openTier(canvas);
    await expect(canvas.getByRole('button', { name: 'This group' })).toBeInTheDocument();
  },
};

/** No group detected — the question has no subject, so the verb is gone. */
export const NoCurrentGroup: Story = {
  args: { hasCurrentGroup: false, currentGroupRelationCount: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openTier(canvas);
    await expect(canvas.queryByRole('button', { name: /This group/ })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /^Duplicates/ })).toBeInTheDocument();
  },
};

/** Export not wired by the host — the descriptor is omitted rather than shipped dead (ADR-0039 §3). */
export const WithoutExport: Story = {
  args: { onExportRules: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Export rules' })).not.toBeInTheDocument();
  },
};

/** At the narrow end of the panel's drag range, where the fit ladder actually runs. */
export const AtPanelWidth: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
