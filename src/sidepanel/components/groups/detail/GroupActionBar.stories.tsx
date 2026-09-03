import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import GroupActionBar from './GroupActionBar';
import type { GroupSummary } from '../../../../shared/types';

/** A plain Okta group, unrelated to any rule or push mapping. */
const group: GroupSummary = {
  id: '00gFAKE000000000001',
  name: 'Engineering',
  description: 'All engineering staff across every team.',
  type: 'OKTA_GROUP',
  memberCount: 128,
  hasRules: false,
  ruleCount: 0,
  usedInRuleCount: 0,
  created: new Date('2023-01-15'),
  lastUpdated: new Date('2026-06-01'),
};

/** The group-detail rung's ADR-0039 action-bar wrapper. */
const meta = {
  title: 'Groups/GroupActionBar',
  component: GroupActionBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The ADR-0039 wrapper `GroupDetailView.tsx` was missing: previously it called the shared ' +
          '`ActionBar` directly with an `export-members` descriptor shipped `disabled: !onExportGroup` ' +
          'whenever that prop was left out — a ghost action with no live wire.\n\n' +
          '**Export members** now only appears in the strip when `onExportGroup` is actually provided ' +
          '(omitted, never disabled-forever).\n\n' +
          '**`Add` is the `primary` and `Export members` is behind More** (ADR-0068). This strip ' +
          'used to lead with *Export members* in the blue button and put *Add* beside it in plain ' +
          '`secondary`. `primary` marks a verb that **acts** — its object is the whole page *and* ' +
          'pressing it opens a modal or performs the operation — and *Add* passes both while an ' +
          'export passes neither: an export descriptor forwards to the Export tab with its column ' +
          'picker and presets, which is navigation wearing a verb’s clothes. So every export ' +
          "descriptor in the app takes `priority: 'tier'`, on every rung, as a flat rule rather " +
          'than a per-strip judgement. *Add* also passes ADR-0039’s consequence test in the row’s ' +
          'favour: an add is undone by a remove.\n\n' +
          '**Compare** sits beside it for the same reason `UserActionBar` puts its own *Compare* in ' +
          'the row: it reads two rosters and writes nothing.\n\n' +
          'The strip has a disclosure tier holding two verbs, one of each shape `ActionBar` ' +
          'offers. First, as a descriptor: **Remove deprovisioned**, ' +
          'the bulk cleanup that empties a group of every member Okta has already deprovisioned. ' +
          'It changes group state with no symmetric undo press, so per ADR-0039 it is ' +
          "`priority: 'tier'` (behind **More** from the start) behind a confirm `Modal` that names " +
          'the count and the group.\n\n' +
          'It is **absent, not disabled**, whenever it cannot honestly run: no `onRemoveDeprovisioned` ' +
          'wire, an `APP_GROUP` (the operation refuses those), or a `deprovisionedCount` of `0` or ' +
          '`undefined` — `undefined` being the pre-analysis state, which is deliberately not shown ' +
          'as zero (ADR-0032 §2a, absent is not zero).\n\n' +
          'Second, in `ActionBar`’s `expansion` slot — where it goes because it ships a line of ' +
          'prose beside it and a descriptor can carry no JSX: **Create feeding rule**. It is ' +
          'behind **More** for ' +
          'its consequence, not its importance (ADR-0039 §2): a rule *grants* memberships as it ' +
          'matches, and deleting it afterwards leaves every one of them in place. The consequence ' +
          'is written beside the control, the way `UserLifecycleActions` writes “Blocks sign-in ' +
          'until reversed”; the confirm dialog itself belongs to `CreateFeedingRuleModal`.',
      },
    },
  },
  args: {
    group,
    targetTabId: 1,
    onExportGroup: fn(),
    onAddMember: fn(),
    onCompare: fn(),
    onRemoveDeprovisioned: fn(),
    deprovisionedCount: 3,
    onCreateFeedingRule: fn(),
    // Nothing scrolls in a story, so the strip renders at its resting geometry.
    sticky: false,
  },
  argTypes: {
    group: { description: 'The group every verb in the strip acts on.' },
    targetTabId: {
      description:
        '`Add` and `Compare` both disable without a connected tab — neither type-ahead has ' +
        'anything to search.',
    },
    onExportGroup: {
      description:
        "Opens the Export tab pre-scoped to this group's members. When omitted, per ADR-0039 " +
        '*Export members* is left out of the strip entirely.',
    },
    onAddMember: { description: 'Opens the Add-member modal.' },
    onCompare: { description: 'Opens the picker for the second group in a comparison.' },
    deprovisionedCount: {
      description:
        'How many loaded members are `DEPROVISIONED`. `undefined` (not yet analyzed) and `0` both ' +
        'omit the action rather than rendering a count the page cannot vouch for.',
    },
    onRemoveDeprovisioned: {
      description:
        'Runs the bulk removal once the confirm modal is accepted. Omitted \u2192 no action.',
    },
    isRemoving: {
      description: 'Holds the confirm button in its loading state while the run is in flight.',
    },
    removeError: {
      description: 'The last error the run reported, shown inside the confirm modal.',
    },
    onCreateFeedingRule: {
      description:
        'Opens the create-feeding-rule confirm dialog. Lives in the disclosure tier because a ' +
        'rule’s grants outlive the rule (ADR-0039 §2).',
    },
    sticky: {
      description: 'Pin the strip below the header. `false` in stories — nothing scrolls.',
    },
  },
} satisfies Meta<typeof GroupActionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Every action wired: Add (primary, pinned) and Compare (flex) in the row, with
 * Export members, Remove deprovisioned and Create feeding rule behind **More**.
 */
export const Default: Story = {};

/**
 * The reference shape for ADR-0068 §3: the verb that **acts** wears the fill, and
 * the export that leaves is behind the disclosure.
 *
 * *Add* opens the add-members modal, which then writes — and an add is undone by
 * a remove, so it owes no confirmation and belongs in the row. *Export members*
 * forwards to the Export tab; it never produces a file in place, so it is never
 * the point of the rung. Its handler and its forwarding behaviour are unchanged;
 * only where it starts moved.
 *
 * Which button is *blue* is not asserted here and cannot be: the headless runner
 * loads no Tailwind, so `variant` has no visible consequence to check. What the
 * assertions below pin is the arrangement — who is in the row, who is behind
 * **More** — which is the half that survives without a stylesheet.
 */
export const AddIsThePrimaryAndExportIsBehindMore: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Asserted structurally, through the region the **More** control names —
    // the same shape `GroupDetailView.test.tsx` uses for the tier. "Is it
    // visible" would not do it: a closed tier is a `0fr` grid row, which is a
    // laid-out box either way.
    const more = canvas.getByRole('button', { name: 'More' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    const tier = document.getElementById(more.getAttribute('aria-controls') ?? '');
    if (!tier) throw new Error('the More control names no region');

    await expect(within(tier).getByRole('button', { name: /Export members/ })).toBeInTheDocument();
    await expect(within(tier).queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Add' })).toBeEnabled();

    // And it is reachable: pressing More discloses it.
    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'true');
  },
};

/** No `onExportGroup` — the strip renders only `Add`, never a disabled ghost button. */
export const ExportOmitted: Story = {
  args: { onExportGroup: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: /Export members/ })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Add' })).toBeEnabled();
  },
};

/** No connected Okta tab — `Add` disables; `Export members` (a client-side navigation) does not. */
export const NoConnectedTab: Story = {
  args: { targetTabId: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Add' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Compare' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: /Export members/ })).toBeEnabled();
  },
};

/**
 * The tier's descriptor half, confirmed. **Remove deprovisioned** is `priority: 'tier'`,
 * so it is behind **More** from the start rather than ever sitting in the row,
 * and it is *accepting the confirm* that calls the handler — never the verb
 * itself. (The row/tier split is `actionBarFit`'s, and has its own table-driven
 * tests; what this story pins is that pressing through both steps reaches the
 * handler exactly once.)
 */
export const RemoveDeprovisioned: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    const more = canvas.getByRole('button', { name: 'More' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(canvas.getByRole('button', { name: /Remove 3 deprovisioned/ }));

    const dialog = body.getByRole('dialog', { name: 'Remove deprovisioned members' });
    await expect(dialog).toHaveTextContent(/3 deprovisioned members from Engineering/);
    await expect(args.onRemoveDeprovisioned).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove 3' }));
    await expect(args.onRemoveDeprovisioned).toHaveBeenCalledTimes(1);
  },
};

/** The confirm, mid-run and then failed — the error lands in the dialog, not a toast. */
export const RemoveFailed: Story = {
  args: { removeError: '403 Forbidden: you lack permission to modify this group' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.click(canvas.getByRole('button', { name: 'More' }));
    await userEvent.click(canvas.getByRole('button', { name: /Remove 3 deprovisioned/ }));

    await expect(body.getByRole('dialog')).toHaveTextContent(/403 Forbidden/);
  },
};

/**
 * Nobody in the group is deprovisioned. The verb is **gone**, not a disabled
 * "Remove 0 deprovisioned" sitting behind **More** forever.
 */
export const NoDeprovisionedMembers: Story = {
  args: { deprovisionedCount: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: /deprovisioned/i })).not.toBeInTheDocument();
  },
};

/**
 * The roster has not been analyzed yet (`deprovisionedCount` is `undefined`).
 * Absent is not zero: the page does not know the count, so it does not offer a
 * verb whose label would have to state one.
 */
export const RosterNotLoaded: Story = {
  args: { deprovisionedCount: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: /deprovisioned/i })).not.toBeInTheDocument();
  },
};

/**
 * An APP_GROUP: membership is mastered by the application, and the operation
 * refuses these outright — so the strip does not offer the verb at all.
 */
export const AppGroupHasNoRemove: Story = {
  args: {
    group: { ...group, type: 'APP_GROUP', name: 'Salesforce Users' },
    deprovisionedCount: 12,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: /deprovisioned/i })).not.toBeInTheDocument();
  },
};

/**
 * The tier's `expansion` half, opened: *Create feeding rule*, with what it leaves
 * behind stated beside it rather than only inside the dialog it opens.
 *
 * **More** belongs to the shared `ActionBar`, not to this component — this story
 * is what proves `GroupActionBar` wires a working one through it, and that the
 * verb it reveals reaches the callback the page gave it.
 */
export const TierOpen: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const more = canvas.getByRole('button', { name: 'More' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'true');

    await expect(canvas.getByText('Memberships a rule grants outlive the rule')).toBeVisible();
    const create = canvas.getByRole('button', { name: 'Create feeding rule' });
    await expect(create).toBeVisible();

    await userEvent.click(create);
    await expect(args.onCreateFeedingRule).toHaveBeenCalledTimes(1);
  },
};

/**
 * No connected Okta tab, tier open: the write verb disables with a reason a
 * reader can act on rather than disappearing — ADR-0039 §3 bans a dead control,
 * not a gated one that says what would un-gate it.
 */
export const TierWithoutConnectedTab: Story = {
  args: { targetTabId: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'More' }));

    const create = canvas.getByRole('button', { name: 'Create feeding rule' });
    await expect(create).toBeDisabled();
    await expect(create).toHaveAttribute('title', 'Connect an Okta tab to create a rule');
  },
};
