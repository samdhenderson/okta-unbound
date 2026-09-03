import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import MemberFilterDrawer, { type MemberFilterDrawerProps } from './MemberFilterDrawer';
import { useMemberFilters } from '../../hooks/useMemberFilters';
import { computeDimensionBreakdown, discoverAttributeBreakdowns } from './memberAnalytics';
import { toMemberSourceSegments } from '../groups/memberSourceBuckets';
import { buildMemberSourceIndex } from '../../../shared/membership/memberSourceIndex';
import MemberSourceNotes from '../groups/detail/MemberSourceNotes';
import type { OktaUser } from '../../../shared/types';
import type { MemberSourceBreakdown } from '../../../shared/membership/groupSource';

/** Thirty members over three departments, two titles, and a mix of statuses. */
const members: OktaUser[] = Array.from({ length: 30 }, (_, i) => ({
  id: `00uFAKE${i + 1}`,
  status: i < 4 ? 'SUSPENDED' : 'ACTIVE',
  profile: {
    login: `member${i + 1}@example.com`,
    email: `member${i + 1}@example.com`,
    firstName: `First${i + 1}`,
    lastName: `Last${i + 1}`,
    department: ['Engineering', 'Support', 'Finance'][i % 3],
    title: i % 2 === 0 ? 'Manager' : 'Individual Contributor',
  },
}));

const breakdown: MemberSourceBreakdown = {
  total: 30,
  direct: 30,
  ruleBased: 0,
  unattributed: 0,
  byRule: [],
};

const memberSource = {
  index: buildMemberSourceIndex(
    { id: '00gFAKE1', name: 'Engineering', type: 'OKTA_GROUP' },
    members,
    [],
  ),
  segments: toMemberSourceSegments(breakdown),
};

/**
 * The drawer reflects the live filter set back into its own pills, so the
 * stories instantiate the real `useMemberFilters` rather than faking one — the
 * same instance `MemberExplorer` owns. That is why the `component` here is this
 * thin wrapper: `memberFilters` is not a knob a story author sets, and the
 * remaining props are exactly the ones that are.
 */
const MemberFilterDrawerWithState = (props: Omit<MemberFilterDrawerProps, 'memberFilters'>) => {
  const memberFilters = useMemberFilters();
  return <MemberFilterDrawer {...props} memberFilters={memberFilters} />;
};

/** Every member control the explorer has, behind one disclosure. */
const meta = {
  title: 'Members/MemberFilterDrawer',
  component: MemberFilterDrawerWithState,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Members tab used to stack seven surfaces above its first member row. This is ' +
          'the drawer half of the replacement: one visible control line, and everything else ' +
          'here — the membership-source strip and its notes, the status/MFA/sort panel, the ' +
          'routes into each profile attribute, and a pointer to the Insights tab where the ' +
          'composition reports now live.\n\n' +
          'The disclosure is the shared `.disclose` height animation, so the contents stay ' +
          '**mounted** while closed and keep their own state across an open/close — and are ' +
          '`inert`, so they leave the tab order *and* the accessible tree, which a `hidden` ' +
          'class would only half do. Reduced motion needs nothing here: `tailwind.css` ' +
          'flattens the transition globally.\n\n' +
          '**Not observable in this runner:** the collapsed height. The headless story runner ' +
          'loads no Tailwind, so the `0fr` grid row is not applied and the drawer measures the ' +
          'same open or closed. The `inert` contract is what these stories assert.',
      },
    },
  },
  args: {
    id: 'member-filter-drawer',
    open: true,
    memberSource,
    sourceDetail: <MemberSourceNotes breakdown={breakdown} />,
    statusRows: computeDimensionBreakdown(members, 'status'),
    mfaResults: null,
    factorLabels: [],
    memberCount: members.length,
    scanStatus: 'idle',
    onRunScanClick: fn(),
    sortBy: 'name',
    sortDesc: false,
    onToggleSort: fn(),
    attributes: discoverAttributeBreakdowns(members),
    filteredDimensions: new Set<string>(),
    onSelectAttribute: fn(),
  },
} satisfies Meta<typeof MemberFilterDrawerWithState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Open, with everything the Group Detail Members tab supplies. */
export const Open: Story = {
  play: async ({ args, canvas }) => {
    await expect(canvas.getByText('Source')).toBeVisible();
    await expect(canvas.getByText('Profile attributes')).toBeVisible();

    await userEvent.click(
      canvas.getByRole('button', { name: 'Title: choose a value to filter by' }),
    );
    await expect(args.onSelectAttribute).toHaveBeenCalledWith('title');
  },
};

/** Closed: mounted, but out of the tab order and the accessible tree. */
export const Closed: Story = {
  args: { open: false },
  play: async ({ canvasElement }) => {
    const region = canvasElement.ownerDocument.getElementById('member-filter-drawer');
    await expect(region).toHaveAttribute('inert');
  },
};

/**
 * The overview surface: no membership-source analysis has run, so there is no
 * strip and no notes. Absent is the correct rendering, not a degraded one —
 * labelling an unclassified roster "Manual" would manufacture a fact.
 */
export const WithoutSourceAnalysis: Story = {
  args: { memberSource: undefined, sourceDetail: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText('Source')).toBeNull();
    await expect(canvas.getByText('Profile attributes')).toBeVisible();
  },
};

/** With a route to the Insights tab, where the composition reports live. */
export const WithInsightsPointer: Story = {
  args: { onOpenInsights: fn() },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open Insights' }));
    await expect(args.onOpenInsights).toHaveBeenCalledTimes(1);
  },
};
