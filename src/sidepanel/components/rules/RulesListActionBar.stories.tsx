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
          '**Where `primary` goes (ADR-0068 §2).** This strip used to open with a **Load rules** ' +
          '/ **Refresh** descriptor, which ADR-0061 made *the* reference example of a list ' +
          "rung's `primary`. ADR-0069 deleted it — the tab fetches on open, and one chrome " +
          'control beside the Pin re-fetches whatever the panel is showing — and ADR-0068 §2 ' +
          'then excluded a fetch from `primary` absolutely. Enumerating what is left ' +
          '(see the comment above the descriptor array) finds **no acting verb** on this rung, ' +
          "so rule 2 applies and the rung's one whole-rung export, **Export rules**, holds " +
          '`primary` and stays in the row. A host that does not wire the export gets rule 3: no ' +
          '`primary` at all.\n\n' +
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
    hasRules: { description: 'Whether any rules are loaded — gates Stats.' },
    duplicateClusterCount: { description: 'Duplicate-condition clusters found. 0 omits the verb.' },
    hasCurrentGroup: { description: 'Whether a group is detected — what This group acts on.' },
    currentGroupRelationCount: { description: 'Distinct related rules. Rides the label above 0.' },
    activePanel: { description: 'Which panel is open; its trigger says Hide … and is pinned.' },
    onTogglePanel: { description: 'Toggles the given panel open/closed.' },
    onExportRules: { description: "Opens the Export tab. This rung's `primary` when wired." },
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

/**
 * The tier region itself, resolved through the **More** control's own `aria-controls`
 * rather than by a test id — so "is this verb in the row or behind More?" is asked of
 * the same wiring a screen reader follows.
 *
 * This is how a story checks `pinned`-ness without checking a colour: the headless
 * runner loads no Tailwind, so `variant: 'primary'` has no visible consequence there,
 * but its *behavioural* consequence — `ActionBar` defaults a `primary` to
 * `priority: 'pinned'`, so it can never be moved behind **More** — is plain DOM.
 */
const tierRegion = (canvasElement: HTMLElement): HTMLElement | null => {
  const more = within(canvasElement).queryByRole('button', { name: 'More' });
  const id = more?.getAttribute('aria-controls');
  return id ? canvasElement.ownerDocument.getElementById(id) : null;
};

/** No verb on this rung fetches — ADR-0069 moved that to the app-level chrome control. */
const expectNoFetchVerb = async (canvas: ReturnType<typeof within>): Promise<void> => {
  await expect(canvas.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
  await expect(canvas.queryByRole('button', { name: /^load/i })).not.toBeInTheDocument();
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The loaded rung. **Export rules** is the row's one verb — and its `primary` — and the
 * three analysis verbs rest behind **More**.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Export rules' })).toBeInTheDocument();
    await expectNoFetchVerb(canvas);
  },
};

/**
 * The ADR-0068 §2 assertion, and the reason this file no longer has a `Refresh` story.
 *
 * Two claims, both structural rather than chromatic. **Export rules** is the rung's
 * `primary`, which `ActionBar` renders as `priority: 'pinned'` — so with the tier open
 * and every panel toggle inside it, the export is still a child of the row and not of the
 * tier region. And **no verb on this rung fetches**: the strip's old dual-purpose
 * *Load rules* / *Refresh* descriptor is gone entirely, in every state, not merely
 * demoted out of the row.
 */
export const TheRungsPrimaryIsItsExport: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openTier(canvas);

    const exportVerb = canvas.getByRole('button', { name: 'Export rules' });
    const tier = tierRegion(canvasElement);
    await expect(tier).not.toBeNull();
    // The panel toggles really are in the tier, so the export's absence from it below
    // is a placement fact and not an empty-tier vacuity.
    await expect(tier?.contains(canvas.getByRole('button', { name: /^Duplicates/ }))).toBe(true);
    await expect(tier?.contains(exportVerb)).toBe(false);

    await expectNoFetchVerb(canvas);
  },
};

/**
 * Nothing loaded yet, and no group in context. Every panel toggle is gone — there is
 * nothing to analyse and nothing to search — so the strip is the export and nothing else,
 * with no tier at all.
 *
 * The rung is **not** a dead end in this state, and this strip is not what saves it:
 * `RulesListPanel`'s empty state carries the *Load Rules* prompt, which is where an
 * initial load belongs (ADR-0069 §4).
 *
 * `hasCurrentGroup: false` is load-bearing here rather than scenery. *This group* is
 * gated on a **detected group**, never on the loaded rules (see the module doc), so
 * leaving the meta default of `true` in place still emits that verb — and with it a
 * **More** control — while the story claims the tier is empty. That is precisely what
 * this story did until it was corrected, and it is the one state in the file where the
 * distinction between the two gates is observable.
 * {@link NothingLoadedWithGroupInContext} now covers what it was accidentally rendering.
 */
export const NothingLoaded: Story = {
  args: {
    hasRules: false,
    duplicateClusterCount: 0,
    hasCurrentGroup: false,
    currentGroupRelationCount: 0,
    search: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Export rules' })).toBeInTheDocument();
    await expectNoFetchVerb(canvas);
    // No tier at all: with every panel verb omitted there is nothing to disclose.
    await expect(canvas.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Stats/ })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Duplicates/ })).not.toBeInTheDocument();
  },
};

/**
 * Nothing loaded, but a group **is** detected on the Okta page — the carve-out the
 * module doc argues for. *This group*'s object is the detected group rather than the
 * loaded rule list, so the verb is offered before a single rule has been fetched, and
 * the tier exists to hold it. *Stats*, whose object genuinely is the loaded rules, is
 * omitted in the same breath — which is what makes this a test of the two gates being
 * different rather than of the tier merely being open.
 */
export const NothingLoadedWithGroupInContext: Story = {
  args: {
    hasRules: false,
    duplicateClusterCount: 0,
    currentGroupRelationCount: 0,
    search: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openTier(canvas);
    await expect(canvas.getByRole('button', { name: 'This group' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Stats/ })).not.toBeInTheDocument();
  },
};

/**
 * The ADR-0061 §2 assertion. Opening a panel changes what the control **says**, not just
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

/**
 * Export not wired by the host — the descriptor is omitted rather than shipped dead
 * (ADR-0039 §3). This is also ADR-0068 §2's **rule 3** rendering: with no acting verb
 * and now no export either, the rung has no `primary` at all, and a strip of
 * evenly-weighted peers is the correct answer rather than a gap to fill. Nothing is
 * promoted to occupy the slot — least of all a fetch.
 */
export const WithoutExport: Story = {
  args: { onExportRules: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Export rules' })).not.toBeInTheDocument();
    await openTier(canvas);
    await expectNoFetchVerb(canvas);
    await expect(canvas.getByRole('button', { name: /^Duplicates/ })).toBeInTheDocument();
  },
};

/** At the narrow end of the panel's drag range, where the fit ladder actually runs. */
export const AtPanelWidth: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
