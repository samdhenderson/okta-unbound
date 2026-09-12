import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import BlastRadiusRuleRow from './BlastRadiusRuleRow';
import type { RuleEffect } from '../../../shared/membership/blastRadiusTypes';

/** Obviously fake ids — no real org data ever ships in a story. */
const effect = (
  over: Partial<RuleEffect> & Pick<RuleEffect, 'ruleId' | 'ruleName' | 'transition'>,
): RuleEffect => ({
  expression: 'user.department == "Sales"',
  targetGroupIds: ['00gFAKE00000000000001'],
  targetGroupNames: ['Sales-All'],
  touchedAttributes: ['department'],
  active: true,
  ...over,
});

/** Whether one group rule's verdict about this user moves under the edit. */
const meta = {
  title: 'Users/BlastRadiusRuleRow',
  component: BlastRadiusRuleRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '**The rule-centric mirror of `BlastRadiusGroupRow`.** The groups view answers *what access ' +
          'changes*; this one answers *what is driving it* — the view an admin needs in order to go and fix a ' +
          'rule rather than a person.\n\n' +
          '**`Could not be evaluated` is neutral, and it is not a fifth shade of “unchanged”.** At least one ' +
          'of the two evaluations produced no answer, so the pair cannot be compared. The sentence comes from ' +
          'the shared `unevaluableReasonText` table rather than being rewritten here, so this surface and ' +
          '`ClauseLedger` cannot end up saying different things about the same reason code. It renders ' +
          'neutral because nothing failed, and a `danger` palette would assert in colour what the sentence ' +
          'declines to assert in words (ADR-0017, ADR-0020).\n\n' +
          '**The expression wraps; it never truncates.** A condition clipped at the row’s edge and set beside ' +
          'a verdict is actively misleading — the clause that decided the verdict is routinely the one past ' +
          'the ellipsis. Expressions, rule names and group names are all end-user-controllable tenant data, ' +
          'rendered through React’s escaping only.\n\n' +
          '**`Reads` is a display aid, never load-bearing.** `touchedAttributes` is approximate by ' +
          'construction — the engine deliberately does *not* pre-filter rules on it, because a miss there ' +
          'would silently drop a real effect rather than merely mislabel one.\n\n' +
          'Related internals: `shared/membership/blastRadius`, `shared/rules/unevaluableReasonText`.',
      },
    },
  },
  decorators: [
    // A row is an `<li>`; ADR-0029's default separator pattern is `space-y-3`
    // around bordered rows, and an `<li>` outside a list is an axe violation.
    (Story) => (
      <ul className="space-y-3">
        <Story />
      </ul>
    ),
  ],
  argTypes: {
    effect: {
      description:
        'One entry from `BlastRadiusReport.rules`. Its `ruleName`, `expression` and `targetGroupNames` are untrusted tenant data — rendered escaped, never logged.',
    },
  },
  args: {
    // Spied so a disclosure story can assert the row reports the toggle rather
    // than owning the state itself.
    onToggle: fn(),
    effect: effect({
      ruleId: '0prFAKErule00001',
      ruleName: 'Sales auto-add',
      transition: 'starts-matching',
    }),
  },
} satisfies Meta<typeof BlastRadiusRuleRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The rule did not match before the edit and does after it. */
export const StartsMatching: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Sales auto-add')).toBeInTheDocument();
    // The verdict is in words, so it never rides on colour alone.
    await expect(canvas.getByText('Starts matching')).toBeInTheDocument();
    await expect(canvas.getByText('Sales-All')).toBeInTheDocument();
    await expect(canvas.getByText('user.department == "Sales"')).toBeInTheDocument();
  },
};

/** The rule matched before the edit and does not after it. */
export const StopsMatching: Story = {
  args: {
    effect: effect({
      ruleId: '0prFAKErule00002',
      ruleName: 'Eng auto-add',
      transition: 'stops-matching',
      expression: 'user.department == "Engineering"',
      targetGroupIds: ['00gFAKE00000000000002'],
      targetGroupNames: ['Engineering-All'],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Stops matching')).toBeInTheDocument();
  },
};

/**
 * One of the two evaluations gave up, so the pair cannot be compared. Neutral,
 * and the reason is the shared table's sentence verbatim.
 */
export const Undetermined: Story = {
  args: {
    effect: effect({
      ruleId: '0prFAKErule00003',
      ruleName: 'Reviewers — by group',
      transition: 'undetermined',
      afterReason: 'regex-unsupported-syntax',
      expression: 'isMemberOfGroupNameRegex("(?=sec)sec-.*")',
      targetGroupIds: ['00gFAKE00000000000003'],
      targetGroupNames: ['Security-Reviewers'],
      touchedAttributes: [],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Could not be evaluated')).toBeInTheDocument();
    // The shared sentence, not a local rewrite of it.
    await expect(canvas.getByText(/syntax this panel does not implement/i)).toBeInTheDocument();
    // And it never claims a direction it did not establish.
    await expect(canvas.queryByText(/Stops matching|Starts matching/)).toBeNull();
  },
};

/**
 * A rule an admin deactivated says so: it places nobody, whichever way its
 * verdict moves — the neutral, unremarkable case. `effect.status` is
 * `'INACTIVE'` here, which keeps the generic "Not in force" pill rather than
 * the `INVALID` rule's `Broken` mark below (D-085).
 */
export const NotInForceRule: Story = {
  args: {
    effect: effect({
      ruleId: '0prFAKErule00004',
      ruleName: 'Legacy intern auto-add',
      transition: 'stops-matching',
      active: false,
      status: 'INACTIVE',
      expression: 'user.title == "Intern"',
      targetGroupIds: ['00gFAKE00000000000004'],
      targetGroupNames: ['Legacy-Interns'],
      touchedAttributes: ['title'],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Not in force')).toBeInTheDocument();
    // Never a status word this row cannot support — and never the `INVALID` mark.
    await expect(canvas.queryByText(/INACTIVE|Inactive/)).toBeNull();
    await expect(canvas.queryByText('Broken')).toBeNull();
  },
};

/**
 * A rule Okta reports as `INVALID` — it can no longer be evaluated, typically
 * because a group its expression names was deleted — gets the same `Broken`
 * mark every other rule surface uses (`ruleStatusBadge`), not the generic
 * "Not in force" pill a deactivated rule keeps.
 *
 * Before this fix, `effect.active` being `false` was the only signal this row
 * had, and it read identically to a rule an admin merely paused — exactly the
 * D-085 defect the shared `Broken` mark exists to close everywhere else.
 */
export const BrokenRule: Story = {
  args: {
    effect: effect({
      ruleId: '0prFAKErule00009',
      ruleName: 'Contractors — deleted group reference',
      transition: 'stops-matching',
      active: false,
      status: 'INVALID',
      expression: 'isMemberOfGroup("00gDELETEDFAKE00001")',
      targetGroupIds: ['00gFAKE00000000000004'],
      targetGroupNames: ['Legacy-Interns'],
      touchedAttributes: [],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Broken')).toBeInTheDocument();
    // Never the generic pill once the specific one applies.
    await expect(canvas.queryByText('Not in force')).toBeNull();
    await expect(canvas.queryByText(/INACTIVE|Inactive/)).toBeNull();
  },
};

/** Carried by the report but collapsed into a count by the report view. */
export const UnchangedMatch: Story = {
  args: {
    effect: effect({
      ruleId: '0prFAKErule00005',
      ruleName: 'Everyone',
      transition: 'unchanged-match',
      expression: 'user.status == "ACTIVE"',
      touchedAttributes: [],
    }),
  },
};

/** The other unchanged verdict, and the one ADR-0020's residual is shaped by. */
export const UnchangedNoMatch: Story = {
  args: {
    effect: effect({
      ruleId: '0prFAKErule00006',
      ruleName: 'Tokyo office',
      transition: 'unchanged-no-match',
      expression: 'user.city == "Tokyo"',
      touchedAttributes: [],
    }),
  },
};

/** Several targets and several read attributes, both wrapping rather than clipping. */
export const ManyTargets: Story = {
  args: {
    effect: effect({
      ruleId: '0prFAKErule00007',
      ruleName: 'EMEA sales enablement',
      transition: 'starts-matching',
      targetGroupIds: ['00gFAKE00000000000001', '00gFAKE00000000000005', '00gFAKE00000000000006'],
      targetGroupNames: ['Sales-All', 'EMEA-Everyone', 'Enablement-Readers'],
      touchedAttributes: ['department', 'countryCode', 'employeeType'],
      expression:
        'user.department == "Sales" && user.countryCode in {"GB", "IE", "FR", "DE"} && user.employeeType != "CONTRACTOR"',
    }),
  },
};

/**
 * The 360px floor. A long condition wraps onto as many lines as it needs — a
 * truncated expression beside a verdict is worse than no expression at all.
 */
export const Compact: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
  args: {
    effect: effect({
      ruleId: '0prFAKErule00008',
      ruleName: 'EMEA sales enablement — contractors excluded',
      transition: 'stops-matching',
      targetGroupIds: ['00gFAKE00000000000001'],
      targetGroupNames: ['emea-sales-enablement-contractors-2026'],
      touchedAttributes: ['department', 'countryCode'],
      expression:
        'user.department == "Sales" && user.countryCode in {"GB", "IE", "FR", "DE"} && user.employeeType != "CONTRACTOR"',
    }),
  },
};

/**
 * A rule whose one affected target group is read by other rules. The trigger
 * names that group, so the panel does not caption it a second time.
 */
export const CascadeSingleGroup: Story = {
  args: {
    effect: effect({
      ruleId: '0prFAKErule00031',
      ruleName: 'Sales onboarding',
      transition: 'starts-matching',
      targetGroupIds: ['00gFAKEnewhires1'],
      targetGroupNames: ['New Hires'],
    }),
    expanded: true,
    cascadeBlocks: [
      {
        groupId: '00gFAKEnewhires1',
        groupName: 'New Hires',
        lines: [
          {
            ruleId: '0prFAKErule00032',
            ruleName: 'Downstream feeder',
            direction: 'toward-match',
            matchedBy: 'name',
            targetGroupNames: ['Finance'],
          },
        ],
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('button', { name: /Rules that use New Hires/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(canvas.getByText('Downstream feeder')).toBeInTheDocument();
    // One block, so the panel adds no caption repeating the group the trigger
    // already named. Scoped to the panel: the row's own "Targets" line names it
    // too, and that is not the duplication being guarded against.
    const panel = canvasElement.querySelector('.disclose');
    await expect(panel?.textContent).not.toMatch(/New Hires/);
  },
};

/**
 * Two affected target groups. **One** disclosure holds both, captioned per group
 * — N triggers above a single panel would put the second trigger above the
 * first one's content.
 */
export const CascadeAcrossTwoGroups: Story = {
  args: {
    effect: effect({
      ruleId: '0prFAKErule00041',
      ruleName: 'Regional onboarding',
      transition: 'starts-matching',
      targetGroupIds: ['00gFAKEnewhires1', '00gFAKEemea00001'],
      targetGroupNames: ['New Hires', 'EMEA'],
    }),
    expanded: false,
    cascadeBlocks: [
      {
        groupId: '00gFAKEnewhires1',
        groupName: 'New Hires',
        lines: [
          {
            ruleId: '0prFAKErule00042',
            ruleName: 'Downstream feeder',
            direction: 'toward-match',
            matchedBy: 'name',
            targetGroupNames: ['Finance'],
          },
        ],
      },
      {
        groupId: '00gFAKEemea00001',
        groupName: 'EMEA',
        lines: [
          {
            ruleId: '0prFAKErule00043',
            ruleName: 'EMEA tooling',
            direction: 'toward-match',
            matchedBy: 'nameContains',
            targetGroupNames: ['EMEA-Tools'],
          },
        ],
      },
    ],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /Rules that use these groups/ });

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    trigger.click();
    await expect(args.onToggle).toHaveBeenCalledWith('0prFAKErule00041');
  },
};

/** Nothing reads the groups this rule assigns, so no trigger renders at all. */
export const NoCascade: Story = {
  args: {
    effect: effect({
      ruleId: '0prFAKErule00051',
      ruleName: 'Sales auto-add',
      transition: 'starts-matching',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: /Rules that use/ })).toBeNull();
  },
};
