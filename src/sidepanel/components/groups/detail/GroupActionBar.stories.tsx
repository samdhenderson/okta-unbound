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
          '(omitted, never disabled-forever). **Add** is the everyday, reversible verb and stays in ' +
          "the row at `priority: 'flex'`, mirroring `UserActionBar`'s treatment of *Add group*. " +
          '**Compare** sits beside it for the same reason that strip puts its own *Compare* in the ' +
          'row: it reads two rosters and writes nothing.\n\n' +
          '**Create feeding rule** is the strip’s first — and so far only — tier action, and the ' +
          'first group-side consumer of `ActionBar`’s `expansion` slot. It is behind **More** for ' +
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

/** Every action wired: Export members (pinned, primary), Add and Compare (flex). */
export const Default: Story = {};

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
 * The strip's first disclosure tier, opened: *Create feeding rule*, with what it
 * leaves behind stated beside it rather than only inside the dialog it opens.
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
