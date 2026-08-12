import type { Meta, StoryObj } from '@storybook/react-vite';
import GroupSourceIndicator from './GroupSourceIndicator';
import type { GroupMembership, MembershipRule } from '../../../../shared/types';

const rule = (id: string, name: string): MembershipRule => ({
  id,
  name,
  status: 'ACTIVE',
  conditionExpression: 'user.userType == "Contractor"',
  groupIds: ['00gFAKEgroup0001'],
  userAttributes: ['userType'],
});

const membership = (over: Partial<GroupMembership> = {}): GroupMembership => ({
  group: { id: '00gFAKEgroup0001', type: 'OKTA_GROUP', profile: { name: 'VPN Access' } },
  membershipType: 'RULE_BASED',
  rules: [rule('0prFAKErule00001', 'Contractors → VPN Access')],
  attribution: 'exact',
  ...over,
});

/** The per-row detail on a group diff row: how the membership was granted, and how far that may be trusted. */
const meta = {
  title: 'Users/Comparison/GroupSourceIndicator',
  component: GroupSourceIndicator,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The per-row detail on a group diff row: how the membership was granted, and how far that may be trusted.\n\n' +
          'Two visual registers, borrowed from its sibling `AppScopeIndicator`. A **chip** is an answer the ' +
          'classifier proved (`Added by Rule: …`, `Added directly`, `Managed by app`); **muted italic text** is ' +
          'anything a reader must not act on as proven — a deduction (`Likely added by rule: …`) or a ' +
          'classification that never happened (`Source not determined`).\n\n' +
          'The captions are `GroupMembershipsList`’s vocabulary verbatim — `exact` → "Added by Rule:", ' +
          '`inferred` → "Likely added by rule:", `ambiguous` → "Possible rule:" — so the same evidence does not ' +
          'read two different ways on two screens.\n\n' +
          'What it refuses to do: credit one rule when the attribution is `ambiguous` (the list is a candidate ' +
          'set, per `membershipAnalysis.attributionNamesRules`), collapse several attributed rules into one, or ' +
          'render an `UNKNOWN` or absent membership as a manual add. No state is a warning or a danger — a ' +
          'rule-granted membership is not a problem.\n\n' +
          '**Related internals:** [membershipAnalysis](?path=/docs/internals-shared-utils--docs)',
      },
    },
  },
  args: { membership: membership() },
  argTypes: {
    membership: {
      description:
        'The membership behind the row, carried whole on `DiffItem.membership`. Omitted (app rows, hand-built fixtures) renders nothing at all — never a manual add.',
    },
  },
} satisfies Meta<typeof GroupSourceIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `exact` + one rule: proven, so the rule is named as the source and chipped. */
export const ExactSingleRule: Story = { args: { membership: membership() } };

/** `exact` + two rules: both really can grant the same membership, so both are named and counted. */
export const ExactMultipleRules: Story = {
  args: {
    membership: membership({
      rules: [
        rule('0prFAKErule00001', 'Contractors → VPN'),
        rule('0prFAKErule00002', 'EMEA → VPN'),
      ],
    }),
  },
};

/** `inferred`: a rule condition could not be evaluated, so the row hedges and drops the chip. */
export const Inferred: Story = {
  args: { membership: membership({ attribution: 'inferred' }) },
};

/**
 * `ambiguous`: the rules are a *candidate set*. Every candidate is listed and the
 * count says they are unresolved, so no single rule reads as the answer.
 */
export const AmbiguousCandidates: Story = {
  args: {
    membership: membership({
      attribution: 'ambiguous',
      rules: [rule('0prFAKErule00002', 'Legacy A'), rule('0prFAKErule00003', 'Legacy B')],
    }),
  },
};

/** `DIRECT`: no active rule explains the membership, so it was added by hand. */
export const Direct: Story = {
  args: { membership: membership({ membershipType: 'DIRECT', rules: [] }) },
};

/**
 * `UNKNOWN`: the rules could not be loaded, so the membership was never
 * classified. Deliberately **not** shown as a direct add.
 */
export const Unknown: Story = {
  args: {
    membership: membership({ membershipType: 'UNKNOWN', rules: [], attribution: 'ambiguous' }),
  },
};

/** An `APP_GROUP`: rule-managed by its mastering application, with no group rule to name. */
export const AppManaged: Story = {
  args: {
    membership: membership({
      group: {
        id: '00gFAKEgroup0002',
        type: 'APP_GROUP',
        profile: { name: 'Salesforce Users' },
      },
      rules: [],
    }),
  },
};

/** No membership at all (an app row, or a fixture without one): nothing renders. */
export const NoMembership: Story = { args: { membership: undefined } };

/** A hostile-length rule name truncates inside its chip instead of overflowing the row. */
export const LongRuleName: Story = {
  render: (args) => (
    <div className="flex w-64 min-w-0 items-center gap-2 border border-neutral-200 p-2">
      <span className="truncate text-sm text-neutral-800">VPN Access</span>
      <GroupSourceIndicator {...args} />
    </div>
  ),
  args: {
    membership: membership({
      rules: [
        rule(
          '0prFAKErule00009',
          'All EMEA contractors with a manager in Finance, excluding interns and seasonal staff, provisioned from Workday',
        ),
      ],
    }),
  },
};

/** Every state at once — the chips read as answers, the muted lines as non-answers. */
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-2">
      <GroupSourceIndicator membership={membership()} />
      <GroupSourceIndicator membership={membership({ attribution: 'inferred' })} />
      <GroupSourceIndicator
        membership={membership({
          attribution: 'ambiguous',
          rules: [rule('0prFAKErule00002', 'Legacy A'), rule('0prFAKErule00003', 'Legacy B')],
        })}
      />
      <GroupSourceIndicator membership={membership({ membershipType: 'DIRECT', rules: [] })} />
      <GroupSourceIndicator
        membership={membership({ membershipType: 'UNKNOWN', rules: [], attribution: 'ambiguous' })}
      />
      <GroupSourceIndicator membership={undefined} />
    </div>
  ),
};
