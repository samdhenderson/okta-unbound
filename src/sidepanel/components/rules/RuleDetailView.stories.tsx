import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import RuleDetailView from './RuleDetailView';
import { NavigationProvider } from '../../contexts/NavigationContext';
import type { FormattedRule } from '../../../shared/types';

const GROUP_A = '00g1a2b3c4d5e6f7g8h9';
const GROUP_B = '00g9z8y7x6w5v4u3t2s1';

/**
 * Group chips are `EntityLink`s, which need a navigation host to be openable — without
 * one every chip degrades to plain text, hiding the affordance these stories exist to show.
 */
const navigationHandlers = { rule: fn(), group: fn(), user: fn(), app: fn(), policy: fn() };

const rule = (over: Partial<FormattedRule> = {}): FormattedRule => ({
  id: '00rFAKE0000000000001',
  name: 'Engineering – Auto-assign by department',
  status: 'ACTIVE',
  condition: 'user.department == "Engineering"',
  conditionExpression: 'user.department == "Engineering"',
  groupIds: [GROUP_A, GROUP_B],
  groupNames: ['Engineering – All', 'Slack – Eng Channel'],
  allGroupNamesMap: { [GROUP_A]: 'Engineering – All', [GROUP_B]: 'Slack – Eng Channel' },
  userAttributes: ['department'],
  created: '2024-01-15T09:00:00.000Z',
  lastUpdated: '2026-06-01T14:30:00.000Z',
  ...over,
});

/** The rule detail rung: one rule's condition, targets, conflicts and provenance. */
const meta = {
  title: 'Rules/RuleDetailView',
  component: RuleDetailView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'All of this was the expanded body of `RuleCard`, which ADR-0030’s inventory named as one ' +
          'of the five layout dialects the app had for what is conceptually one thing — eyebrow ' +
          'blocks on `bg-neutral-50`, `tracking-wider`, a hand-laid action row. It was the last of ' +
          'the five never converted. Three things follow from converting it:\n\n' +
          '- **The verbs get a strip.** Four of them were flex-wrapped at the bottom of a card body, ' +
          'which is exactly the "the page’s main verb read as a section’s property" failure ' +
          'ADR-0030 §2 exists to stop. They are ' +
          '[RuleActionBar](?path=/docs/rules-ruleactionbar--docs) now, split by the consequence test ' +
          'rather than by what fitted.\n' +
          '- **The sections get the shared primitive.** `DetailSection`’s `tracking-wide` eyebrow is ' +
          'the survivor of the `tracking-wide`/`tracking-wider` split this body was on the wrong ' +
          'side of.\n' +
          '- **There is room.** Feature H — the clause-level rule explainer — names "a rule’s card in ' +
          'the Rules tab" as its surface, and a per-clause pass/fail breakdown against a picked user ' +
          'does not fit in a list row’s disclosure.\n\n' +
          'A `DetailSection` **stack**, not tabbed panes: `docs/components.md` reserves the tabbed ' +
          'shape for a rung answering several questions about one entity, and a rule has one ' +
          'condition and three facts about it, all already in hand.\n\n' +
          '**There is no header here.** `RulesTab` keeps one `PageHeader` and feeds it ' +
          '`ruleIdentity` (ADR-0032), so this view never repeats the rule’s name, status, id or ' +
          'counts. In the explorer that header is simply absent — these stories start at the strip.\n\n' +
          '**It fetches nothing.** Everything shown is already on the `FormattedRule` the list was ' +
          'rendering, which is what lets the tab push the rung straight from a row with no loading ' +
          'state.',
      },
    },
  },
  decorators: [
    (Story) => (
      <NavigationProvider handlers={navigationHandlers}>
        <div className="p-(--sp-gutter)">
          <Story />
        </div>
      </NavigationProvider>
    ),
  ],
  args: {
    rule: rule(),
    oktaOrigin: 'https://example.okta.com',
    onPreviewImpact: fn(),
    tierOpen: false,
    onTierOpenChange: fn(),
    isLifecycleLoading: false,
    isConfirmingActivate: false,
    onRequestActivate: fn(),
    onCancelActivate: fn(),
    onConfirmActivate: fn(),
    onRequestDeactivate: fn(),
    onAddTargetGroup: fn(),
    // Nothing scrolls in a story, so the strip renders at its resting geometry.
    sticky: false,
  },
  argTypes: {
    rule: { description: 'The rule being browsed.' },
    oktaOrigin: { description: 'Okta org origin, for the Admin Console rules-page link.' },
    onPreviewImpact: {
      description: 'Opens the impact preview. Omitted when the rule targets no groups.',
    },
    tierOpen: { description: 'Whether the strip’s disclosure tier is open.' },
    sticky: {
      description: 'Pin the strip below the header. `false` in stories — nothing scrolls.',
    },
  },
} satisfies Meta<typeof RuleDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An active rule with two named target groups. */
export const Default: Story = {};

/**
 * Every target group resolved to a name: each is an openable chip whose copy control names
 * the **id**, not the group, because two groups in one rule can share a display name and a
 * derived default would collide (I-009).
 */
export const NamedTargetGroups: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Open group Engineering – All' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: `Copy group id ${GROUP_A}` }),
    ).toBeInTheDocument();
  },
};

/**
 * The same rule with **no names resolved**. The view states the gap — "Group name not
 * loaded" — and puts the raw id in the identifier register beside its copy control, rather
 * than printing the id where a name belongs (I-003). Nothing here fetches, so the name
 * cannot be filled in at render time; the group can still be **opened** by its id, which
 * is the capability the local chip this replaced was missing (I-017).
 */
export const UnresolvedTargetGroups: Story = {
  args: { rule: rule({ groupNames: undefined, allGroupNamesMap: {} }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('Group name not loaded')).toHaveLength(2);
    // Retargeted (ADR-0022): the old assertion was that nothing claimed to open an
    // unresolved target, which was the capability gap I-017 closed. What still holds
    // — and is what I-003 cared about — is that no chip presents the id as a name;
    // the "Group name not loaded" count above pins that.
    await expect(
      canvas.getAllByRole('button', { name: /^Group name not loaded — open group 00g/ }),
    ).toHaveLength(2);
  },
};

/**
 * A target group that **no longer exists**, against a completed group walk (D-061).
 *
 * The distinction this story exists to hold is against
 * [UnresolvedTargetGroups](?path=/story/rules-ruledetailview--unresolved-target-groups),
 * which looks superficially similar and means something entirely different: that one says
 * *this view has not learned the name*, this one says *there is nothing left to name*. A
 * rule assigning into a deleted group is `ACTIVE`, adds nobody, and used to render exactly
 * like a working rule.
 *
 * It takes a warning's weight because it is a proven answer — the producer only sets
 * `missingGroupIds` when the group inventory is complete, so the claim is never made off a
 * half-read walk.
 */
export const MissingTargetGroup: Story = {
  args: {
    rule: rule({
      groupNames: ['Engineering – All', GROUP_B],
      allGroupNamesMap: { [GROUP_A]: 'Engineering – All' },
      missingGroupIds: [GROUP_B],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Group no longer exists')).toBeInTheDocument();
    // Said once in the chip and once in the section's description, so the fact is
    // legible whether the reader is scanning the list or reading the sentence.
    await expect(canvas.getByText(/One target no longer exists/)).toBeInTheDocument();
    // The surviving target is unaffected and still openable.
    await expect(
      canvas.getByRole('button', { name: 'Open group Engineering – All' }),
    ).toBeInTheDocument();
  },
};

/**
 * A condition expression that names a group by id. The literal is replaced by the chip it
 * resolves to — the same trade `RuleExpressionText` makes for the Group Detail clause
 * view, so the app's two renderers of rule conditions read alike.
 */
export const ConditionNamesAGroup: Story = {
  args: {
    rule: rule({
      condition: `isMemberOfAnyGroup("${GROUP_A}")`,
      conditionExpression: `isMemberOfAnyGroup("${GROUP_A}")`,
    }),
  },
};

/**
 * A rule that assigns to no groups: it matches users and then does nothing with them.
 *
 * That is a finding, so it is **stated**, not left as an empty list — and it is also why
 * the strip has no *Preview impact* here. Without the sentence the page would be quietly
 * missing both the fact and the reason its verb went away.
 */
export const NoTargetGroups: Story = {
  args: { rule: rule({ groupIds: [], groupNames: [] }), onPreviewImpact: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/assigns to no groups/)).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Preview impact' })).not.toBeInTheDocument();
  },
};

/** A detected conflict against another loaded rule, with its severity and reason. */
export const WithConflicts: Story = {
  args: {
    rule: rule({
      conflicts: [
        {
          rule1: { id: '00rFAKE0000000000001', name: 'Engineering – Auto-assign by department' },
          rule2: { id: '00rFAKE0000000000002', name: 'Contractors – Auto-assign by department' },
          reason: 'Both rules assign users to "Engineering – All" based on overlapping conditions.',
          severity: 'high',
          affectedGroups: [GROUP_A],
        },
      ],
    }),
  },
};

/** The strip's tier open, over the rule's content. */
export const TierOpen: Story = {
  args: { tierOpen: true },
};

/**
 * No org origin, so the "In Okta" section is absent entirely rather than rendering a dead
 * link. Note what the section says when it *is* present: Okta has no per-rule route, so
 * the honest target is the org's rules list and the copy states that instead of implying
 * the link opens this rule.
 */
export const WithoutOktaOrigin: Story = {
  args: { oktaOrigin: null },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole('link', { name: /Open the rules page/ }),
    ).not.toBeInTheDocument();
  },
};

/** The 360px panel floor: the condition scrolls inside its own box rather than widening the page. */
export const Narrow: Story = {
  args: {
    rule: rule({
      conditionExpression:
        'user.department == "Engineering" AND user.employeeType == "Full-Time" AND user.countryCode == "GB"',
    }),
  },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
