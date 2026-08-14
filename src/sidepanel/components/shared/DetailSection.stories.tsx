import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import DetailSection from './DetailSection';
import Badge from './Badge';
import Button from './Button';
import EntityLink from './EntityLink';
import { NavigationProvider } from '../../contexts/NavigationContext';

/**
 * The card-shaped section every detail view is built from — eyebrow heading,
 * optional explanation, optional header slot, body.
 */
const meta = {
  title: 'Shared/DetailSection',
  component: DetailSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'White card wrapper for one section of a detail view. Elevation comes from the 1px border alone, per the Odyssey surface model — no drop shadow on cards.\n\n' +
          'Originally scoped to the Group Detail view; promoted to the shared barrel when the detail pages adopted one layout language, because four other surfaces were hand-rolling near-copies with a drifting eyebrow (`tracking-wider` elsewhere against `tracking-wide` here).\n\n' +
          '**What belongs in `actions`:** a verb scoped to *this section\'s data* — a gate button that loads it, a control that mutates it, a count of it. A verb whose object is the whole page belongs in `ActionBar`. The split is not cosmetic: a page-level slot has no view of whether this section is loaded, so putting "Add member" there would let a reader mutate a list still behind its gate.',
      },
    },
  },
  argTypes: {
    title: { description: 'Section heading, rendered as an uppercase eyebrow `<h2>`.' },
    description: { description: 'Optional one-line explanation under the heading.' },
    actions: {
      description:
        'Optional right-aligned header node (a count badge, a gated action button). Section-scoped verbs only.',
    },
    headingId: {
      description:
        'Id for the heading element, so a body region can point at it with `aria-labelledby`.',
    },
    children: { description: 'Section body.' },
  },
  args: {
    title: 'App push',
    children: <p className="text-sm text-neutral-600">No push mappings for this group.</p>,
  },
} satisfies Meta<typeof DetailSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Heading and body only. */
export const Default: Story = {};

/** With the one-line explanation under the heading. */
export const WithDescription: Story = {
  args: {
    title: 'Membership source',
    description: 'Splits the current members into rule-managed and manual.',
  },
};

/** A count in the header slot — the lightest thing that slot carries. */
export const WithCountBadge: Story = {
  args: {
    title: 'Group memberships',
    actions: <Badge variant="neutral">7</Badge>,
  },
};

/** A gated action in the header slot, scoped to this section's data. */
export const WithGatedAction: Story = {
  args: {
    title: 'Membership source',
    description: 'Splits the current members into rule-managed and manual.',
    actions: (
      <Button variant="secondary" size="sm" icon="chart" onClick={fn()}>
        Analyze
      </Button>
    ),
    children: (
      <p className="text-sm text-neutral-500">
        Not analyzed yet. Reads all 412 members once, then classifies each against the rules that
        assign into this group.
      </p>
    ),
  },
};

/** Several sections stacked, which is how a detail page actually reads. */
export const Stacked: Story = {
  render: () => (
    <NavigationProvider handlers={{ rule: fn(), app: fn() }}>
      <div className="space-y-3 bg-canvas p-3">
        <DetailSection title="Rules" description="What feeds this group, and what points at it.">
          <div className="flex flex-wrap gap-2">
            <EntityLink type="rule" id="0prFAKERULE00001" name="Sales territory assignment" />
            <EntityLink type="rule" id="0prFAKERULE00002" name="Contractor onboarding" />
          </div>
        </DetailSection>
        <DetailSection title="Grants access to" actions={<Badge variant="neutral">3</Badge>}>
          <div className="flex flex-wrap gap-2">
            <EntityLink type="app" id="0oaFAKEAPP000001" name="Salesforce" />
            <EntityLink type="app" id="0oaFAKEAPP000002" name="Gong" />
            <EntityLink type="app" id="0oaFAKEAPP000003" name="Tableau" />
          </div>
        </DetailSection>
        <DetailSection title="Metadata">
          <p className="font-mono text-xs text-neutral-500">00gFAKEGROUP0001</p>
        </DetailSection>
      </div>
    </NavigationProvider>
  ),
};
