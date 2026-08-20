import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import BlastRadiusReport from './BlastRadiusReport';
import type {
  BlastRadiusReport as BlastRadiusReportData,
  GroupEffect,
  RuleEffect,
} from '../../../shared/membership/blastRadiusTypes';

/** Obviously fake ids — no real org data ever ships in a story. */
const SALES_RULE = '0prFAKErule00001';
const ENG_RULE = '0prFAKErule00002';

const GROUPS: GroupEffect[] = [
  {
    groupId: '00gFAKE00000000000001',
    groupName: 'Sales-All',
    kind: 'likely-added',
    ruleId: SALES_RULE,
    ruleName: 'Sales auto-add',
    contributingRuleIds: [SALES_RULE],
    currentlyHeld: false,
  },
  {
    groupId: '00gFAKE00000000000002',
    groupName: 'Engineering-All',
    kind: 'likely-removed',
    ruleId: ENG_RULE,
    ruleName: 'Eng auto-add',
    contributingRuleIds: [ENG_RULE],
    currentlyHeld: true,
    currentBucket: 'rule',
  },
  {
    groupId: '00gFAKE00000000000003',
    groupName: 'Contractors',
    kind: 'not-predicted',
    contributingRuleIds: [ENG_RULE],
    withheldReason: 'membership-not-credited-to-rule',
    currentlyHeld: true,
    currentBucket: 'direct',
  },
];

const RULES: RuleEffect[] = [
  {
    ruleId: SALES_RULE,
    ruleName: 'Sales auto-add',
    expression: 'user.department == "Sales"',
    transition: 'starts-matching',
    targetGroupIds: ['00gFAKE00000000000001'],
    targetGroupNames: ['Sales-All'],
    touchedAttributes: ['department'],
    active: true,
  },
  {
    ruleId: ENG_RULE,
    ruleName: 'Eng auto-add',
    expression: 'user.department == "Engineering"',
    transition: 'stops-matching',
    targetGroupIds: ['00gFAKE00000000000002'],
    targetGroupNames: ['Engineering-All'],
    touchedAttributes: ['department'],
    active: true,
  },
  {
    ruleId: '0prFAKErule00003',
    ruleName: 'Reviewers — by group',
    expression: 'isMemberOfGroupNameRegex("^sec-.*$")',
    transition: 'undetermined',
    afterReason: 'group-name-regex',
    targetGroupIds: ['00gFAKE00000000000004'],
    targetGroupNames: ['Security-Reviewers'],
    touchedAttributes: [],
    active: true,
  },
  {
    ruleId: '0prFAKErule00004',
    ruleName: 'Everyone',
    expression: 'user.status == "ACTIVE"',
    transition: 'unchanged-match',
    targetGroupIds: ['00gFAKE00000000000005'],
    targetGroupNames: ['Everyone'],
    touchedAttributes: [],
    active: true,
  },
  {
    ruleId: '0prFAKErule00005',
    ruleName: 'Tokyo office',
    expression: 'user.city == "Tokyo"',
    transition: 'unchanged-no-match',
    targetGroupIds: ['00gFAKE00000000000006'],
    targetGroupNames: ['Tokyo-Everyone'],
    touchedAttributes: [],
    active: true,
  },
];

const COMPUTED: BlastRadiusReportData = {
  status: 'computed',
  groups: GROUPS,
  rules: RULES,
  counts: { added: 1, removed: 1, notPredicted: 1, starts: 1, stops: 1, undetermined: 1 },
  secondOrderPossible: true,
  secondOrderRuleNames: ['Managers of Sales', 'Sales tooling'],
};

const EMPTY = (status: BlastRadiusReportData['status']): BlastRadiusReportData => ({
  status,
  groups: [],
  rules: [],
  counts: { added: 0, removed: 0, notPredicted: 0, starts: 0, stops: 0, undetermined: 0 },
  secondOrderPossible: false,
  secondOrderRuleNames: [],
});

/** What this profile edit is predicted to do to a user's group access. */
const meta = {
  title: 'Users/BlastRadiusReport',
  component: BlastRadiusReport,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '**A report an admin opts into, and it costs zero API calls.** The engine behind it is pure and ' +
          'synchronous — it reads the user, the draft, the complete membership list and the rule inventory ' +
          'the panel already holds. Nothing here fetches, and nothing recomputes on a keystroke.\n\n' +
          '**Three statuses, three different things to say.** `not-computed` renders *nothing* — the parent ' +
          'owns the button that asks, and a report that renders before it was asked for is a report an admin ' +
          'will read as an answer. `unavailable` says the org’s group rules could not be loaded, so no ' +
          'prediction is possible — emphatically **not** “no changes”; collapsing an inability into a ' +
          'negative is the one move ADR-0020 forbids and the one this surface is most tempted by. `computed` ' +
          'renders the report, and a computed report with zero effects says so explicitly.\n\n' +
          '**Two views of one answer.** *Groups* is the consequence, *Rules* is the cause. The pills switch ' +
          'between them; nothing is recomputed by the switch. The rules view keeps the unaffected rules as a ' +
          'count rather than dropping them, because “and 2 rules are unaffected” is a fact about how much of ' +
          'the org was examined.\n\n' +
          '**Second-order effects are named, not resolved.** Gaining or losing a group can flip an ' +
          '`isMemberOf*` clause in some other rule. The engine makes a single pass and then says how many ' +
          'rules could cascade, because iterating would consume a *likely* as a fact and leave no vocabulary ' +
          'to carry the accumulated doubt.\n\n' +
          'Related internals: `shared/membership/blastRadius`, `sidepanel/hooks/useBlastRadius`.',
      },
    },
  },
  argTypes: {
    report: {
      description:
        'The report from `useBlastRadius`. Every string on it — group names, rule names, condition expressions — is untrusted tenant data.',
    },
    className: { description: 'Layout and spacing classes on the outer container.' },
  },
  args: { report: COMPUTED },
} satisfies Meta<typeof BlastRadiusReport>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The groups view: what access is likely gained, likely lost, and what the engine
 * declined to call — the third with equal standing and a stated reason.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Every prediction is hedged in the words themselves, and each block is a
    // real section heading rather than a decorative label.
    await expect(canvas.getByRole('heading', { name: 'Likely added' })).toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: 'Likely removed' })).toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: 'Not predicted' })).toBeInTheDocument();

    await expect(canvas.getByText('Sales-All')).toBeInTheDocument();
    await expect(canvas.getByText('Engineering-All')).toBeInTheDocument();

    // The withheld row names its reason rather than reading as "no change".
    await expect(canvas.getByText(/credits this membership to a direct add/i)).toBeInTheDocument();

    // Second-order effects are named, not resolved.
    await expect(canvas.getByText(/2 rules test membership of a group/i)).toBeInTheDocument();
  },
};

/** The rules view, reached by the pill. The same report — nothing is recomputed. */
export const RulesView: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rules = canvas.getByRole('button', { name: 'Rules 3' });

    await expect(rules).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(rules);
    await expect(rules).toHaveAttribute('aria-pressed', 'true');

    await expect(canvas.getByRole('heading', { name: 'Starts matching' })).toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: 'Stops matching' })).toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', { name: 'Could not be evaluated' }),
    ).toBeInTheDocument();

    // The unchanged rules are carried, not dropped: how much was examined is a fact.
    await expect(canvas.getByText('And 2 rules are unaffected by this edit.')).toBeInTheDocument();

    // Switching back leaves the groups view intact.
    await userEvent.click(canvas.getByRole('button', { name: 'Groups 3' }));
    await expect(canvas.getByText('Sales-All')).toBeInTheDocument();
  },
};

/**
 * The rule inventory could not be loaded. This is a finding in its own right, and
 * it is not "no changes" — nothing at all can be predicted.
 */
export const Unavailable: Story = {
  args: { report: EMPTY('unavailable') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/could not be loaded/i)).toBeInTheDocument();
    await expect(canvas.getByText(/not the same as predicting no change/i)).toBeInTheDocument();
    // No pills, because there is no report to switch views of.
    await expect(canvas.queryByRole('button', { name: /^Groups/ })).toBeNull();
  },
};

/** A computed report with nothing in it says so — an absence is never left implicit. */
export const NoEffects: Story = {
  args: { report: EMPTY('computed') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No group changes predicted')).toBeInTheDocument();
    // Even here the caveat stands: "no change predicted" is still a prediction.
    await expect(canvas.getByText(/Predictions are likely, not certain/i)).toBeInTheDocument();
  },
};

/**
 * Nobody has asked yet, so the report renders nothing at all — a parent may mount
 * it unconditionally beside its own Analyze button.
 */
export const NotComputed: Story = {
  args: { report: EMPTY('not-computed') },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent?.trim()).toBe('');
  },
};

/**
 * The 360px floor. The pills wrap before a count is lost, and the row interiors
 * wrap rather than truncating a group name or a condition.
 */
export const Compact: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
