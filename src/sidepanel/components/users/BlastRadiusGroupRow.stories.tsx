import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import BlastRadiusGroupRow from './BlastRadiusGroupRow';
import type { GroupEffect } from '../../../shared/membership/blastRadiusTypes';

/** Obviously fake ids — no real org data ever ships in a story. */
const RULE_ID = '0prFAKErule00001';

const effect = (
  over: Partial<GroupEffect> & Pick<GroupEffect, 'groupId' | 'groupName' | 'kind'>,
): GroupEffect => ({
  contributingRuleIds: [RULE_ID],
  currentlyHeld: false,
  ...over,
});

/** What one profile edit is predicted to do to one group's membership. */
const meta = {
  title: 'Users/BlastRadiusGroupRow',
  component: BlastRadiusGroupRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '**Every prediction is `likely`, and the hedge is in the label.** The engine cannot see a rule’s ' +
          'exclusion list, evaluates conditions with a client-side reimplementation of Okta EL rather than ' +
          'Okta EL, and Okta applies rules asynchronously. So the marker’s accessible name is `Likely added` / ' +
          '`Likely removed`, never `Added` / `Removed` — a caption a layout can drop is not where a hedge ' +
          'belongs.\n\n' +
          '**`Not predicted` is neutral, never `danger`.** It is a peer of the other two kinds, not their ' +
          'absence: it is emitted only where something *was* implicated and the engine declined to call it, ' +
          'and it always names why. `ClauseChecklist` settled the precedent — a clause this panel declines to ' +
          'evaluate is *not evaluated*, never *failed* — and colouring a withheld prediction red would restate ' +
          'in colour exactly what the sentence carefully avoids saying. A removal is `warning` rather than ' +
          '`danger` for the neighbouring reason: it is a consequence to flag, not a failure that occurred.\n\n' +
          '**The marker is a status, not a control.** A `role="img"` span carrying its own accessible name — ' +
          'the pattern `ComparisonAttributeRow`’s `=`/`≠` marker established — because the section `Eyebrow` ' +
          'above the block is only a label, and a row read out of that context must still say what it means. ' +
          'The `?` on a withheld row is `membershipVerdict`’s hedge marker, the same one the Groups pane uses.' +
          '\n\n' +
          '**A withheld row shows how Okta credits the membership today**, as a `Badge`, because that fact is ' +
          'what makes “we are not predicting this” legible rather than evasive.\n\n' +
          'Related internals: `shared/membership/blastRadius`, `sidepanel/hooks/useBlastRadius`.',
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
        'One entry from `BlastRadiusReport.groups`. Its `groupName`, `ruleName` and `blockingRuleName` are untrusted tenant data — rendered escaped, never logged.',
    },
  },
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000001',
      groupName: 'Sales-All',
      kind: 'likely-added',
      ruleId: RULE_ID,
      ruleName: 'Sales auto-add',
    }),
  },
} satisfies Meta<typeof BlastRadiusGroupRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A gain: one rule starts matching, and the user does not already hold the group. */
export const LikelyAdded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Sales-All')).toBeInTheDocument();
    // The hedge is in the marker's accessible name, not in a caption.
    await expect(canvas.getByRole('img', { name: 'Likely added' })).toBeInTheDocument();
    await expect(canvas.queryByRole('img', { name: 'Added' })).toBeNull();
    await expect(canvas.getByText(/starts matching this user/i)).toBeInTheDocument();
  },
};

/**
 * A loss. `warning`, not `danger`: losing access is a consequence to flag, not a
 * failure that has happened.
 */
export const LikelyRemoved: Story = {
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000002',
      groupName: 'Engineering-All',
      kind: 'likely-removed',
      ruleId: RULE_ID,
      ruleName: 'Eng auto-add',
      currentlyHeld: true,
      currentBucket: 'rule',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', { name: 'Likely removed' })).toBeInTheDocument();
    await expect(canvas.getByText(/stops matching this user/i)).toBeInTheDocument();
  },
};

/**
 * More than one rule is implicated, so the engine sets no single `ruleName` and
 * the row counts them rather than naming whichever sorted first.
 */
export const SeveralRules: Story = {
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000003',
      groupName: 'EMEA-Everyone',
      kind: 'likely-added',
      contributingRuleIds: [RULE_ID, '0prFAKErule00002', '0prFAKErule00003'],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('3 rules start matching this user.')).toBeInTheDocument();
  },
};

/** Withheld: a different active rule holds the membership open, and it is named. */
export const NotPredictedAnotherRuleMatches: Story = {
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000004',
      groupName: 'Contractors',
      kind: 'not-predicted',
      withheldReason: 'another-active-rule-still-matches',
      blockingRuleName: 'Contractor catch-all',
      currentlyHeld: true,
      currentBucket: 'rule',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Neutral marker, hedged glyph, and a reason — never a quiet "no change".
    await expect(canvas.getByRole('img', { name: 'Not predicted' })).toBeInTheDocument();
    await expect(canvas.getByText(/Contractor catch-all/)).toBeInTheDocument();
    // How Okta credits it today is on the row, so the refusal is legible.
    await expect(canvas.getByText('Rule')).toBeInTheDocument();
  },
};

/** Withheld: Okta credits the membership to a direct add, so no rule can take it. */
export const NotPredictedDirectMembership: Story = {
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000005',
      groupName: 'Ops-Handbook',
      kind: 'not-predicted',
      withheldReason: 'membership-not-credited-to-rule',
      currentlyHeld: true,
      currentBucket: 'direct',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/credits this membership to a direct add/i)).toBeInTheDocument();
    await expect(canvas.getByText('Direct')).toBeInTheDocument();
  },
};

/** Withheld: the attribution behind the membership was itself a deduction. */
export const NotPredictedAttributionHedged: Story = {
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000006',
      groupName: 'Security-Reviewers',
      kind: 'not-predicted',
      withheldReason: 'membership-attribution-hedged',
      currentlyHeld: true,
      currentBucket: 'rule',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/was never established/i)).toBeInTheDocument();
  },
};

/**
 * The load-bearing one: another rule targeting the group could not be evaluated,
 * so an `unevaluable` is never quietly read as a "no" (ADR-0017, ADR-0020).
 */
export const NotPredictedRuleUnevaluable: Story = {
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000007',
      groupName: 'Finance-All',
      kind: 'not-predicted',
      withheldReason: 'rule-unevaluable-after',
      currentlyHeld: true,
      currentBucket: 'rule',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/could not be evaluated here/i)).toBeInTheDocument();
    // The sentence stops short of saying the membership survives, too.
    await expect(canvas.getByText(/cannot say the membership ends/i)).toBeInTheDocument();
  },
};

/** Withheld: the only implicated rule is INACTIVE, so it places nobody either way. */
export const NotPredictedRuleInactive: Story = {
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000008',
      groupName: 'Legacy-Interns',
      kind: 'not-predicted',
      withheldReason: 'rule-inactive',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Retargeted (D-085): the sentence no longer says "inactive". This reason
    // fires whenever no candidate rule is ACTIVE, which now includes INVALID,
    // so the copy names both cases. Same strength, corrected subject.
    await expect(canvas.getByText(/deactivated or no longer evaluable/i)).toBeInTheDocument();
    await expect(canvas.queryByText(/rule is inactive/i)).not.toBeInTheDocument();
  },
};

/** Withheld: an `APP_GROUP` roster is fed by its application, not by group rules. */
export const NotPredictedAppMastered: Story = {
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000009',
      groupName: 'workday.contractors',
      kind: 'not-predicted',
      withheldReason: 'app-mastered-group',
      currentlyHeld: true,
      currentBucket: 'app',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/managed by its application/i)).toBeInTheDocument();
    await expect(canvas.getByText('App')).toBeInTheDocument();
  },
};

/**
 * The 360px floor. A long group name wraps rather than truncating — the name of
 * the group whose access is about to move is never the thing that gets cut.
 */
export const Compact: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
  args: {
    effect: effect({
      groupId: '00gFAKE00000000000010',
      groupName: 'emea-sales-enablement-contractors-2026',
      kind: 'likely-removed',
      ruleId: RULE_ID,
      ruleName: 'EMEA sales enablement — contractors only',
      currentlyHeld: true,
      currentBucket: 'rule',
    }),
  },
};
