import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
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
          "the row at `priority: 'flex'`, mirroring `UserActionBar`'s treatment of *Add group*.\n\n" +
          'Unlike `UserActionBar`, this strip ships with **no disclosure tier** — there is no ' +
          "group-level verb today that changes the group's state with no symmetric undo, so there is " +
          'nothing to put behind **More**.',
      },
    },
  },
  args: {
    group,
    targetTabId: 1,
    onExportGroup: fn(),
    onAddMember: fn(),
    // Nothing scrolls in a story, so the strip renders at its resting geometry.
    sticky: false,
  },
  argTypes: {
    group: { description: 'The group every verb in the strip acts on.' },
    targetTabId: {
      description: '`Add` disables without a connected tab — the type-ahead has nothing to search.',
    },
    onExportGroup: {
      description:
        "Opens the Export tab pre-scoped to this group's members. When omitted, per ADR-0039 " +
        '*Export members* is left out of the strip entirely.',
    },
    onAddMember: { description: 'Opens the Add-member modal.' },
    sticky: {
      description: 'Pin the strip below the header. `false` in stories — nothing scrolls.',
    },
  },
} satisfies Meta<typeof GroupActionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Both actions wired: Export members (pinned, primary) and Add (flex). */
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
    await expect(canvas.getByRole('button', { name: /Export members/ })).toBeEnabled();
  },
};
