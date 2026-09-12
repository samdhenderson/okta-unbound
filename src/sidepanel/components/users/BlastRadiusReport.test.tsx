/**
 * Behaviour tests for the blast-radius report.
 *
 * The stories already render every status and both views (ADR-0011), so this
 * suite deliberately does **not** re-assert what a screenshot would show. It
 * pins the two things that are invisible in a render and expensive to get wrong:
 *
 * 1. **The view switch is one report, two projections.** Pressing a pill must
 *    change what is on screen and the pills' `aria-pressed`, and must not lose
 *    the caveats that qualify both views.
 * 2. **An inability never renders as a negative.** `unavailable` must not
 *    produce any of the reassuring copy the `computed`-and-empty state owns.
 *    That is the ADR-0020 invariant this surface is most tempted to break, and
 *    it is an assertion about what is *absent*, which no story expresses well.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BlastRadiusReport from './BlastRadiusReport';
import type {
  BlastRadiusReport as BlastRadiusReportData,
  GroupEffect,
  RuleEffect,
} from '../../../shared/membership/blastRadiusTypes';

const SALES_RULE = '0prFAKErule00001';
const ENG_RULE = '0prFAKErule00002';

const groups: GroupEffect[] = [
  {
    groupId: '00gFAKE00000000000001',
    groupName: 'Sales-All',
    kind: 'added',
    ruleId: SALES_RULE,
    ruleName: 'Sales auto-add',
    contributingRuleIds: [SALES_RULE],
    currentlyHeld: false,
  },
  {
    groupId: '00gFAKE00000000000003',
    groupName: 'Contractors',
    kind: 'not-predicted',
    contributingRuleIds: [ENG_RULE],
    withheldReason: 'another-active-rule-still-matches',
    blockingRuleName: 'Contractor catch-all',
    currentlyHeld: true,
    currentBucket: 'rule',
  },
];

const rules: RuleEffect[] = [
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

const computed: BlastRadiusReportData = {
  status: 'computed',
  groups,
  rules,
  counts: { added: 1, removed: 0, notPredicted: 1, starts: 1, stops: 0, undetermined: 0 },
  // 'Tokyo office' reads Sales-All and assigns Tokyo-Everyone — the one-hop
  // cascade the disclosures render.
  cascades: [
    {
      groupId: '00gFAKE00000000000001',
      rules: [{ ruleId: '0prFAKErule00005', direction: 'toward-match', matchedBy: 'name' }],
    },
  ],
};

const emptyOf = (status: BlastRadiusReportData['status']): BlastRadiusReportData => ({
  status,
  groups: [],
  rules: [],
  counts: { added: 0, removed: 0, notPredicted: 0, starts: 0, stops: 0, undetermined: 0 },
  cascades: [],
});

describe('BlastRadiusReport', () => {
  it('switches between the group and rule projections of one report', async () => {
    render(<BlastRadiusReport report={computed} />);

    const groupsPill = screen.getByRole('button', { name: 'Groups 2' });
    // The count is of *affected* rules, so the two unchanged ones are excluded.
    const rulesPill = screen.getByRole('button', { name: 'Rules 1' });

    expect(groupsPill).toHaveAttribute('aria-pressed', 'true');
    expect(rulesPill).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Sales-All')).toBeInTheDocument();

    await userEvent.click(rulesPill);

    expect(rulesPill).toHaveAttribute('aria-pressed', 'true');
    expect(groupsPill).toHaveAttribute('aria-pressed', 'false');
    // The blocks are real section headings, so the report joins the outline.
    expect(screen.getByRole('heading', { name: 'Starts matching' })).toBeInTheDocument();
    expect(screen.getByText('Sales auto-add')).toBeInTheDocument();
    // The unchanged rules are carried as a count, not silently dropped.
    expect(screen.getByText('And 2 rules are unaffected by this edit.')).toBeInTheDocument();

    await userEvent.click(groupsPill);
    expect(screen.getByRole('heading', { name: 'Added' })).toBeInTheDocument();
  });

  it('says how many of the unaffected rules were never read', async () => {
    // A rule that could not be read but that this edit cannot reach is collapsed
    // into the tail count rather than listed as a finding — that is the whole
    // point of the arm. But the tail must not let it pass silently: "unaffected"
    // and "unread" are different facts, and the count would otherwise read as the
    // first when half of it is the second.
    const outOfReach: RuleEffect = {
      ruleId: '0prFAKErule00006',
      ruleName: 'Contractor pattern',
      expression: 'isMemberOfGroupNameRegex("(?=contractor).*")',
      transition: 'unchanged-unevaluable',
      beforeReason: 'regex-unsupported-syntax',
      afterReason: 'regex-unsupported-syntax',
      targetGroupIds: ['00gFAKE00000000000007'],
      targetGroupNames: ['Contractors'],
      touchedAttributes: [],
      active: true,
    };

    render(<BlastRadiusReport report={{ ...computed, rules: [...rules, outOfReach] }} />);
    await userEvent.click(screen.getByRole('button', { name: /^Rules \d+$/ }));

    expect(screen.getByText(/And 3 rules are unaffected by this edit\./)).toBeInTheDocument();
    expect(
      screen.getByText(
        /1 of those could not be read, but it reads no attribute this edit changes\./,
      ),
    ).toBeInTheDocument();
    // And it is not listed as a finding.
    expect(screen.queryByText('Contractor pattern')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Could not be evaluated' }),
    ).not.toBeInTheDocument();
  });

  it('keeps an open cascade across a switch, and hedges nothing else', async () => {
    render(<BlastRadiusReport report={computed} />);

    // Retargeted from the flat second-order footnote this replaced. The invariant
    // is the same one: what the report says about the cascade survives the pill
    // switch, and nothing on screen is hedged.
    const trigger = screen.getByRole('button', { name: /Rules that use this group/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/prediction stops at one hop/i)).toBeInTheDocument();
    // The standing "predictions are likely, not certain" footnote is gone: the
    // report asserts its predictions rather than qualifying them.
    expect(screen.queryByText(/Predictions are likely, not certain/i)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Rules 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Groups 2' }));

    // Still open: the report owns the state, so the rows remounting does not
    // silently collapse what the admin opened.
    expect(screen.getByRole('button', { name: /Rules that use this group/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.queryByText(/Predictions are likely, not certain/i)).toBeNull();
  });

  it('states the cascade as structure, never as a prediction', async () => {
    render(<BlastRadiusReport report={computed} />);

    await userEvent.click(screen.getByRole('button', { name: /Rules that use this group/ }));

    expect(screen.getByText('Tokyo office')).toBeInTheDocument();
    expect(screen.getByText(/Tokyo-Everyone/)).toBeInTheDocument();
    expect(screen.getByText('Toward matching')).toBeInTheDocument();
    // No hedge, and no count that would claim the listing is complete.
    expect(screen.queryByText(/\bmay\b/i)).toBeNull();
    expect(screen.queryByText(/\b1 rule uses\b/i)).toBeNull();
  });

  it('offers no cascade trigger for a group nothing reads', () => {
    render(<BlastRadiusReport report={{ ...computed, cascades: [] }} />);

    // Omitted entirely rather than shown empty or disabled: the scan
    // under-reports, so an absence is a claim it cannot back.
    expect(screen.queryByRole('button', { name: /Rules that use/ })).toBeNull();
    expect(screen.queryByText(/prediction stops at one hop/i)).toBeNull();
  });

  it('names why a prediction was withheld instead of omitting the group', () => {
    render(<BlastRadiusReport report={computed} />);

    // The withheld group is listed with equal standing, and the blocking rule is
    // named — a withheld effect is never a quieter way of saying "no change".
    expect(screen.getByText('Contractors')).toBeInTheDocument();
    expect(screen.getByText(/Contractor catch-all/)).toBeInTheDocument();
  });

  it('renders nothing at all until a report has been computed', () => {
    const { container } = render(<BlastRadiusReport report={emptyOf('not-computed')} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('reports an unavailable inventory as an inability, never as "no changes"', () => {
    render(<BlastRadiusReport report={emptyOf('unavailable')} />);

    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    // None of the reassuring copy that belongs to the computed-and-empty state.
    expect(screen.queryByText('No group changes predicted')).toBeNull();
    expect(screen.queryByText(/no membership is predicted to change/i)).toBeNull();
    // And nothing to browse, because there is no finding to browse.
    expect(screen.queryByRole('button', { name: /^Groups/ })).toBeNull();
  });

  it('states a computed-but-empty result rather than leaving it implicit', () => {
    render(<BlastRadiusReport report={emptyOf('computed')} />);

    expect(screen.getByText('No group changes predicted')).toBeInTheDocument();
    // The empty state carries no standing hedge either.
    expect(screen.queryByText(/Predictions are likely, not certain/i)).toBeNull();
  });
});
