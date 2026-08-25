import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import CompareGroupModal from './CompareGroupModal';
import type { GroupSummary } from '../../../../shared/types';

const summary = (
  over: Partial<GroupSummary> & Pick<GroupSummary, 'id' | 'name'>,
): GroupSummary => ({
  type: 'OKTA_GROUP',
  memberCount: 0,
  hasRules: false,
  ruleCount: 0,
  usedInRuleCount: 0,
  ...over,
});

const group = summary({ id: '00gFAKE000000000001', name: 'Engineering', memberCount: 128 });

const hits: GroupSummary[] = [
  summary({ id: '00gFAKE000000000002', name: 'Engineering — Contractors', memberCount: 14 }),
  summary({ id: '00gFAKE000000000003', name: 'Product', memberCount: 61 }),
  summary({
    id: '00gFAKE000000000004',
    name: 'Payroll app users',
    type: 'APP_GROUP',
    memberCount: 1,
  }),
];

/** The second-operand picker behind the Group Detail rung's *Compare* action. */
const meta = {
  title: 'Groups/CompareGroupModal',
  component: CompareGroupModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Comparing groups is not new — `GroupComparisonModal` and `api.compareGroups` already do ' +
          'the overlap analysis, and the Groups list opens them by ticking 2–5 rows. A detail page ' +
          'has no rows to tick, so this modal supplies the missing second operand and hands both ' +
          'groups to that same modal.\n\n' +
          'A pure view over `useGroupComparison`, the way `AddGroupMemberModal` is a pure view over ' +
          '`useAddGroupMember`. Each hit shows its **member count**, which is not decoration: ' +
          '`GroupComparisonModal` computes the unique/shared split against `memberCount`, so the ' +
          "picker uses the Groups tab's `expand=stats` live search rather than the lightweight " +
          '`searchGroups` that Add-to-Group uses and that returns no count.\n\n' +
          '*Compare* stays disabled until a group is chosen, and the group being viewed is never ' +
          'among the hits — comparing it with itself is a tautology, not a result.',
      },
    },
  },
  args: {
    isOpen: true,
    group,
    query: '',
    onQueryChange: fn(),
    results: [],
    isSearching: false,
    searchError: null,
    selected: null,
    onSelect: fn(),
    onClearSelected: fn(),
    canSearch: true,
    onClose: fn(),
    onConfirm: fn(),
  },
  argTypes: {
    group: { description: 'The group on screen — the first operand, named in the field label.' },
    results: { description: 'Hits, with the viewed group already removed by the hook.' },
    canSearch: { description: 'False with no connected Okta tab; the field disables with a hint.' },
    selected: { description: 'The chosen second operand. Null ⇒ *Compare* is disabled.' },
  },
} satisfies Meta<typeof CompareGroupModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing typed yet: an empty field and a disabled *Compare*. */
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Compare' })).toBeDisabled();
  },
};

/** A query with hits — each row carries the member count the comparison needs. */
export const WithResults: Story = {
  args: { query: 'eng', results: hits },
};

/** Mid-search: the field shows its spinner while the debounced request is out. */
export const Searching: Story = {
  args: { query: 'eng', isSearching: true },
};

/** A group chosen: the field collapses to its summary and *Compare* enables. */
export const GroupChosen: Story = {
  args: { selected: hits[1] },
  play: async ({ args, canvas }) => {
    const compare = canvas.getByRole('button', { name: 'Compare' });
    await expect(compare).toBeEnabled();
    await userEvent.click(compare);
    await expect(args.onConfirm).toHaveBeenCalled();
  },
};

/** No connected Okta tab: the field disables and says why, rather than searching nothing. */
export const NoConnectedTab: Story = {
  args: { canSearch: false },
};

/** The search itself failed — reported as a `danger` alert, not an empty result list. */
export const SearchFailed: Story = {
  args: { query: 'eng', searchError: 'Failed to search groups' },
};
