import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import EntityLink from './EntityLink';
import { NavigationProvider } from '../../contexts/NavigationContext';

const handlers = { rule: fn(), group: fn(), user: fn(), app: fn(), policy: fn() };

/**
 * A reference to another entity, as a chip that opens it on its own tab — or as
 * plain text when it cannot be opened.
 */
const meta = {
  title: 'Shared/EntityLink',
  component: EntityLink,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One component for every "that rule / that group / that user / that app" reference, so a cross-reference looks and behaves the same wherever it appears.\n\n' +
          'The type glyph and trailing chevron are the point: `RuleCard` currently renders its target groups as pills identical to the neighbouring *attribute* pills, which do nothing when clicked. The chevron says "this goes somewhere" — and appears only when that is true.\n\n' +
          '**Not every name can be linked.** A rule condition\'s `isMemberOfGroupName("sales")` carries a name and no id, and one name can match an Okta group *and* a Workday group. `PushGroupMapping.targetGroupName` names a group inside the downstream app, which is not an Okta entity at all. Omit `id` for those and the name renders as plain text with a tooltip saying why, rather than as a control that cannot work.\n\n' +
          'The same fallback covers an entity kind the current build cannot reach, so a link is never dead.\n\n' +
          'Related internals: `sidepanel/contexts/NavigationContext`.',
      },
    },
  },
  decorators: [
    (Story) => (
      <NavigationProvider handlers={handlers}>
        <Story />
      </NavigationProvider>
    ),
  ],
  argTypes: {
    type: {
      description: 'Which kind of entity this is — picks the glyph and the destination tab.',
    },
    id: {
      description:
        "The entity's Okta id. **Omit when the reference carries only a name**; the chip then renders as plain text.",
    },
    name: { description: 'The visible name. Truncates rather than overflowing.' },
    unlinkableReason: {
      description:
        'Why this reference cannot be opened, shown as the tooltip on the plain-text fallback. Defaults to a generic "no id available" sentence.',
    },
    className: { description: 'Extra classes merged after the chip classes.' },
    testId: { description: 'Optional test handle.' },
  },
  args: {
    type: 'rule',
    id: '0prFAKERULE00001',
    name: 'Sales territory assignment',
  },
} satisfies Meta<typeof EntityLink>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A navigable rule. */
export const Default: Story = {};

/** One chip per entity kind, so the glyphs can be compared. */
export const EveryType: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <EntityLink type="rule" id="0prFAKERULE00001" name="Sales territory assignment" />
      <EntityLink type="group" id="00gFAKEGROUP0001" name="Sales — West" />
      <EntityLink type="user" id="00uFAKEUSER00001" name="Jane Doe" />
      <EntityLink type="app" id="0oaFAKEAPP000001" name="Salesforce" />
      <EntityLink type="policy" id="00pFAKEPOLICY001" name="Contractor MFA" />
    </div>
  ),
};

/**
 * A name with no id. The rule matches the group by name, and a name can match
 * groups from more than one source, so there is nothing single to open.
 */
export const NotLinkable: Story = {
  args: {
    type: 'group',
    id: undefined,
    name: 'sales',
    unlinkableReason:
      'This rule matches the group by name, and a name can match groups from more than one source, so there is no single group to open.',
  },
};

/** Linkable and un-linkable side by side — the difference must be legible at a glance. */
export const LinkableVersusNot: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <EntityLink type="group" id="00gFAKEGROUP0001" name="Sales — West" />
      <EntityLink
        type="group"
        name="sales"
        unlinkableReason="Matched by name only — no group id is available."
      />
    </div>
  ),
};

/** A long name truncates inside a narrow container rather than overflowing it. */
export const Truncates: Story = {
  render: () => (
    <div className="w-48 border border-neutral-200 p-2">
      <EntityLink
        type="rule"
        id="0prFAKERULE00002"
        name="Contractor onboarding — Workday sourced, EMEA region only"
      />
    </div>
  ),
};

/**
 * With no `NavigationProvider` mounted, every kind reports as unreachable and the
 * chip degrades to plain text — which is what makes it safe in isolation.
 */
export const NoNavigationAvailable: Story = {
  decorators: [(Story) => <Story />],
};
