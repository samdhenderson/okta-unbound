import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupRulesSection from './GroupRulesSection';

/** Obviously-fake rules that assign members into the group. */
const assigning = [
  { id: '0prFAKE000000000001', name: 'All Engineers', status: 'ACTIVE' },
  { id: '0prFAKE000000000002', name: 'Contractors intake', status: 'INACTIVE' },
];

/** Obviously-fake rules that merely read the group in a condition. */
const referencing = [
  {
    id: '0prFAKE000000000003',
    name: 'Privileged access gate',
    status: 'ACTIVE',
    conditionExpression: 'isMemberOfAnyGroup("00gFAKE000000000001")',
  },
];

const meta = {
  title: 'Groups/GroupRulesSection',
  component: GroupRulesSection,
  tags: ['autodocs'],
  parameters: {
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          'Section 3 of the Group Detail view: the two rule relationships a group can have.\n\n' +
          'A rule either **assigns members into** the group (`assignUserToGroups`) or **consults** it in ' +
          'its condition (`isMemberOfAnyGroup("…")`). Those are opposite facts — one populates the group, ' +
          'the other reads it — so they are listed separately and counted separately, never summed.\n\n' +
          'Each axis owns its own async states. Loading shows a `Skeleton` at the `lineRow` variant, ' +
          'which is the shape of the `RuleLinkRow`s about to arrive; `idle` shows nothing at all, ' +
          'because no load is in flight to preview.',
      },
    },
  },
  argTypes: {
    assigningRules: { description: 'Rules whose `assignUserToGroups` targets this group.' },
    assigningStatus: { description: 'Status of the assigning-rules load.' },
    assigningError: { description: 'Error message when the assigning-rules load failed.' },
    referencingRules: { description: 'Rules whose condition expression names this group by id.' },
    referencingStatus: { description: 'Status of the referencing-rules load.' },
    referencingError: { description: 'Error message when the referencing-rules load failed.' },
    onNavigateToRule: { description: 'Deep-links a rule in the Rules tab.' },
  },
  args: {
    assigningRules: assigning,
    assigningStatus: 'done',
    assigningError: null,
    referencingRules: referencing,
    referencingStatus: 'done',
    referencingError: null,
    onNavigateToRule: fn(),
  },
} satisfies Meta<typeof GroupRulesSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Both relationships loaded, each counted in its own heading. */
export const Default: Story = {};

/** Without a navigation handler the rows are inert markup, not buttons. */
export const NotNavigable: Story = {
  args: { onNavigateToRule: undefined },
};

/** Both axes loading: one-line row placeholders in the list's own rhythm. */
export const Loading: Story = {
  args: {
    assigningStatus: 'loading',
    assigningRules: [],
    referencingStatus: 'loading',
    referencingRules: [],
  },
};

/** One axis still loading while the other has already resolved. */
export const PartiallyLoaded: Story = {
  args: { referencingStatus: 'loading', referencingRules: [] },
};

/** Nothing started yet — no placeholder, because nothing is in flight. */
export const Idle: Story = {
  args: {
    assigningStatus: 'idle',
    assigningRules: [],
    referencingStatus: 'idle',
    referencingRules: [],
  },
};

/** A group no rule touches, with a distinct message per axis. */
export const Empty: Story = {
  args: { assigningRules: [], referencingRules: [] },
};

/** One axis failed; the other still shows its rules. */
export const ErrorState: Story = {
  args: {
    referencingStatus: 'error',
    referencingError: 'Rules listing unavailable',
    referencingRules: [],
  },
};
