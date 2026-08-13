import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ComparisonDiffTab from './ComparisonDiffTab';
import GroupSourceIndicator from './GroupSourceIndicator';
import AppScopeIndicator from './AppScopeIndicator';
import Button from '../../shared/Button';
import type { ParityRow } from './comparisonAnalytics';
import type { GroupMembership, MembershipRule } from '../../../../shared/types';

const rule = (id: string, name: string): MembershipRule => ({
  id,
  name,
  status: 'ACTIVE',
  conditionExpression: 'user.userType == "Contractor"',
  groupIds: ['00gFAKEgroup0001'],
  userAttributes: ['userType'],
});

const membership = (
  id: string,
  name: string,
  over: Partial<GroupMembership> = {},
): GroupMembership => ({
  group: { id, type: 'OKTA_GROUP', profile: { name } },
  membershipType: 'RULE_BASED',
  rules: [rule('0prFAKErule00001', 'Contractors → VPN Access')],
  attribution: 'exact',
  ...over,
});

const groupRow = (
  id: string,
  name: string,
  inContext: boolean,
  inCompared: boolean,
  over: Partial<GroupMembership> = {},
): ParityRow => ({
  id,
  label: name,
  inContext,
  inCompared,
  membership: membership(id, name, over),
});

const GROUP_ROWS: ParityRow[] = [
  groupRow('00gFAKEgroup0001', 'us.employees.union', false, true),
  groupRow('00gFAKEgroup0002', 'okta.admins', false, true, {
    group: { id: '00gFAKEgroup0002', type: 'APP_GROUP', profile: { name: 'okta.admins' } },
    membershipType: 'DIRECT',
    rules: [],
  }),
  groupRow('00gFAKEgroup0003', 'emea.contractors', true, false, {
    membershipType: 'DIRECT',
    rules: [],
  }),
  groupRow('00gFAKEgroup0004', 'build.engineers', true, true),
  groupRow('00gFAKEgroup0005', 'all.employees', true, true),
];

const APP_ROWS: ParityRow[] = [
  { id: 'app1', label: 'Salesforce', inContext: false, inCompared: true },
  { id: 'app2', label: 'Figma', inContext: true, inCompared: false },
  { id: 'app3', label: 'Slack', inContext: true, inCompared: true },
];

/** One list where every row states the comparison: two sides, a marker, and the action that closes the gap. */
const meta = {
  title: 'Users/Comparison/ComparisonDiffTab',
  component: ComparisonDiffTab,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One list where **every row states the comparison**: the context user on the left, the compared user ' +
          'on the right, and an equality marker between them.\n\n' +
          'This replaced three tone-coded buckets (onlyCompared / shared / onlyContext) that shared the ' +
          "panel's height in proportion to their row counts. That failed twice over: it separated the two users " +
          '*spatially*, so reading a row meant knowing which card you were in, and it gave most of the screen ' +
          'to `shared` — the one group nobody acts on. A 65-group comparison handed 53 shared rows ~80% of the ' +
          'panel and left the 12 actionable ones scrolling in a sliver.\n\n' +
          'The arrow on an Add button sits on the edge nearest the marker and points **inward**, so the gesture ' +
          'and the goal are the same thing: close the `≠`. The middle cell borrows the button silhouette so the ' +
          'three cells read as one set, but it is inert — no `<button>`, not focusable, `role="img"` with a ' +
          'label. `=` and `≠` are different glyphs, so the state never depends on colour.\n\n' +
          'A side that lacks the item and *cannot* be given it (an app row, an app-mastered group) renders a ' +
          'stated non-answer rather than a button that would fail.\n\n' +
          'It also fixes a subtler wrong: under buckets a successful copy made the Add button *vanish*, because ' +
          'the row moved to another card. Here the row flips `≠` → `=` where you are already looking.',
      },
    },
  },
  args: {
    contextName: 'Sam',
    comparedName: 'Jordan',
    noun: 'group',
    emptyText: 'Neither user is in any groups.',
    rows: GROUP_ROWS,
  },
} satisfies Meta<typeof ComparisonDiffTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The groups tab: both copy directions, provenance under each differing row. */
export const Groups: Story = {
  args: {
    renderContextAction: (row) =>
      row.membership?.group.type === 'APP_GROUP' ? null : (
        <Button size="sm" variant="primary" icon="plus" onClick={fn()}>
          Add
        </Button>
      ),
    renderComparedAction: () => (
      <Button size="sm" variant="primary" icon="plus" onClick={fn()}>
        Add
      </Button>
    ),
    renderMeta: (row) =>
      row.inContext && row.inCompared ? null : <GroupSourceIndicator membership={row.membership} />,
  },
};

/** A copy in flight: the global single-flight lock disables every other Add. */
export const CopyInFlight: Story = {
  args: {
    renderContextAction: (row) =>
      row.membership?.group.type === 'APP_GROUP' ? null : (
        <Button
          size="sm"
          variant="primary"
          icon="plus"
          loading={row.id === '00gFAKEgroup0001'}
          disabled
          onClick={fn()}
        >
          Add
        </Button>
      ),
    renderComparedAction: () => (
      <Button size="sm" variant="primary" icon="plus" disabled onClick={fn()}>
        Add
      </Button>
    ),
  },
};

/** No actions at all — how the list reads before the copy hooks are wired. */
export const ReadOnly: Story = {};

/** The apps tab: same row, no buttons, scope instead of provenance. */
export const Apps: Story = {
  args: {
    noun: 'app',
    emptyText: 'Neither user is assigned any apps.',
    rows: APP_ROWS,
    renderMeta: (row) =>
      row.inContext && row.inCompared ? (
        <AppScopeIndicator state="notCompared" />
      ) : (
        <AppScopeIndicator state={row.inCompared ? 'USER' : 'GROUP'} />
      ),
  },
};

/** Nothing to compare at all — distinct from "nothing matches the filter". */
export const Empty: Story = {
  args: { rows: [] },
};

/** Enough rows that the list scrolls inside the panel rather than the page. */
export const LongList: Story = {
  args: {
    rows: [
      ...GROUP_ROWS,
      ...Array.from({ length: 24 }, (_, i) =>
        groupRow(`00gFAKEbulk${i}`, `bulk.group.${String(i).padStart(2, '0')}`, true, true),
      ),
    ],
    renderContextAction: () => (
      <Button size="sm" variant="primary" icon="plus" onClick={fn()}>
        Add
      </Button>
    ),
  },
};
