import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import CauseWorklistRow from './CauseWorklistRow';
import { NavigationProvider } from '../../../contexts/NavigationContext';
import type { AccessCause } from './accessCause';
import type { ClauseExplanation } from '../../../../shared/rules/explainExpression';

/** Fixtures are hand-built — the row is the unit under review, not the classifier. */
const failing = (expressionText: string, resolvedValue: ClauseExplanation['resolvedValue']) =>
  ({ expressionText, resolvedValue, status: 'fail' }) satisfies ClauseExplanation;

const blocked: AccessCause = {
  groupId: '00gFAKE001',
  groupName: 'Engineering — Platform',
  remedy: 'blocked-by-attribute',
  ruleId: '0prFAKE001',
  ruleName: 'Platform engineers',
  failingClauses: [failing('user.department == "Platform"', 'Support')],
};

/** One row of the cause worklist. */
const meta = {
  title: 'Users/Comparison/CauseWorklistRow',
  component: CauseWorklistRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One group on the cause worklist: its name, the rule it hinges on, the failing-clause evidence, and the jump into the full clause checklist.\n\n' +
          'A `cannot-determine` row renders its reason as a sentence in the **neutral** palette — never `danger`, never `warning`. The clause preview is capped, with the remainder counted and left to the checklist. Long group and rule names wrap rather than overflow.\n\n' +
          "Group ids **inside** the clause text are named by the same `resolveGroupName` the prerequisite lists use, so the evidence and the list above it read the same way. An id neither that resolver nor the clause's own matched references can name keeps its raw quoted form.",
      },
    },
  },
  decorators: [
    (Story) => (
      <NavigationProvider handlers={{ group: fn() }}>
        <ul className="space-y-2 p-3">
          <Story />
        </ul>
      </NavigationProvider>
    ),
  ],
  args: { cause: blocked, onViewClauses: fn() },
  argTypes: {
    cause: { description: 'The classified difference. Its group and rule names are untrusted.' },
    onViewClauses: {
      description:
        'Opens the full clause checklist for this cause. Omitted, the row offers no jump.',
    },
    resolveGroupName: {
      description:
        'Names the group ids in the rule condition — in the prerequisite lists and inside the failing-clause text alike. Without it, ids stay raw.',
    },
  },
} satisfies Meta<typeof CauseWorklistRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A blocked row: the rule, the failing clause, and the value that drove it. */
export const BlockedByAttribute: Story = {};

/** More failing clauses than the preview shows — the remainder is counted, not dropped. */
export const ManyFailingClauses: Story = {
  args: {
    cause: {
      ...blocked,
      failingClauses: [
        failing('user.department == "Platform"', 'Support'),
        failing('user.title != "Contractor"', 'Contractor'),
        failing('user.costCenter == "R&D"', 'G&A'),
        failing('user.employeeNumber != null', null),
        failing('user.locale == "en_US"', undefined),
      ],
    },
  },
};

/** No rule accounts for the access — nothing to explain, just an action. */
export const ManualAdd: Story = {
  args: {
    cause: {
      groupId: '00gFAKE003',
      groupName: 'Finance Approvers',
      remedy: 'manual-add',
      failingClauses: [],
    },
  },
};

/** Neutral, with a sentence saying why — never a failure treatment. */
export const CannotDetermine: Story = {
  args: {
    cause: {
      groupId: '00gFAKE004',
      groupName: 'Regional Leads',
      remedy: 'cannot-determine',
      undeterminedReason: 'unevaluable-clause',
      ruleId: '0prFAKE004',
      ruleName: 'Leads by region',
      failingClauses: [],
    },
  },
};

/** A long group and rule name must wrap, never overflow the side panel. */
export const LongGroupName: Story = {
  args: {
    cause: {
      ...blocked,
      groupName:
        'Engineering — Platform — Identity and Access Management — Contractors — EMEA — Read Only — Provisioned via Workday — Do Not Delete',
      ruleName:
        'All Workday-provisioned contractors in EMEA with a read-only entitlement on the identity platform',
    },
  },
};

/** Without a host that can navigate, the evidence stays but the jump goes. */
export const WithoutClauseDeepLink: Story = {
  args: { onViewClauses: undefined },
};

/** A cause whose failing clause names two groups by id — one known, one not. */
const byGroupMembership: AccessCause = {
  ...blocked,
  remedy: 'needs-group-membership',
  failingClauses: [
    {
      expressionText: 'isMemberOfAnyGroup("00gFAKE010", "00gFAKE099")',
      resolvedValue: undefined,
      status: 'fail',
      groupRequirement: 'member',
      groupReferences: [
        { match: 'id', value: '00gFAKE010', satisfied: false },
        { match: 'id', value: '00gFAKE099', satisfied: false },
      ],
    },
  ],
};

/** The host's name source — the comparison's group inventory, already in hand. */
const resolveGroupName = (groupId: string): string | undefined =>
  groupId === '00gFAKE010' ? 'Platform Engineers' : undefined;

/**
 * With a resolver: the known id reads as its group inside the clause text, and
 * the unknown one keeps its raw quoted id — a name that is not loaded is never a
 * reason to show a half-labelled badge.
 */
export const GroupIdsNamedInClauseText: Story = {
  args: { cause: byGroupMembership, resolveGroupName },
};

/** The fallback, whole: no resolver at all, so the clause prints exactly as before. */
export const GroupIdsUnresolved: Story = {
  args: { cause: byGroupMembership },
};
