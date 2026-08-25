import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import DetailSection from './DetailSection';
import Badge from './Badge';
import Button from './Button';
import FilterPill from './FilterPill';
import Input from './Input';
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
          '**`title` is optional.** A tab already names its pane, so a section titled "Members" inside a tab labelled "Members" is the tab-level echo of ADR-0032\'s *the header describes the entity; the body must not repeat it*. A tab whose whole body is one section renders it untitled; a tab holding several titles each.\n\n' +
          "**`band` is a slot, not call-site markup.** Filter chrome has to reach the card's edges to read as chrome rather than as content, and a call site cannot do that from inside a padded body without a negative margin. The card holds the padding boundary; the band sits outside it. `overflow-hidden` is applied only when a band is present, so a section without one keeps the box model it always had.\n\n" +
          '**What belongs in `actions`:** a verb scoped to *this section\'s data* — a gate button that loads it, a control that mutates it, a count of it. A verb whose object is the whole page belongs in `ActionBar`. The split is not cosmetic: a page-level slot has no view of whether this section is loaded, so putting "Add member" there would let a reader mutate a list still behind its gate.',
      },
    },
  },
  argTypes: {
    title: {
      description:
        'Section heading, rendered as an uppercase eyebrow `<h2>`. Optional — omit when the surrounding tab already names this content.',
    },
    band: {
      description:
        "Optional full-bleed band above the body, for a section's filter chrome. Supply contents only; padding, background and separator are the component's.",
    },
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

/**
 * Untitled — the shape a tab uses when its whole body is one section. The header
 * row is dropped entirely rather than rendered empty, so the body sits at the
 * card's own padding. The tab panel above supplies the accessible name.
 */
export const Untitled: Story = {
  args: {
    title: undefined,
    children: (
      <p className="text-sm text-neutral-600">
        The pane&apos;s content starts at the top of the card, with nothing repeating the tab&apos;s
        label.
      </p>
    ),
  },
};

/**
 * A full-bleed filter band above the body — search, pills, and whatever else is
 * chrome rather than content. Note the band reaches both card edges and clips
 * against the radius; the body below keeps its own padding.
 */
export const WithBand: Story = {
  args: {
    title: undefined,
    band: (
      <div className="space-y-3">
        <p className="text-xs text-neutral-600">62 by rule · 38 direct</p>
        <Input
          size="sm"
          type="search"
          value=""
          onChange={fn()}
          ariaLabel="Filter members"
          placeholder="Filter members…"
        />
        <div className="flex flex-wrap gap-1.5">
          <FilterPill active onClick={fn()}>
            All 100
          </FilterPill>
          <FilterPill active={false} onClick={fn()}>
            By rule 62
          </FilterPill>
          <FilterPill active={false} onClick={fn()}>
            Direct 38
          </FilterPill>
        </div>
      </div>
    ),
    children: (
      <ul className="space-y-1.5 text-sm text-neutral-700">
        <li>Ada Lovelace</li>
        <li>Alan Turing</li>
        <li>Grace Hopper</li>
      </ul>
    ),
  },
};

/** A band under a titled section — both header row and band render, in that order. */
export const TitledWithBand: Story = {
  args: {
    title: 'Members',
    actions: <Badge variant="neutral">100</Badge>,
    band: <p className="text-xs text-neutral-600">62 by rule · 38 direct</p>,
    children: <p className="text-sm text-neutral-600">Roster goes here.</p>,
  },
};

/**
 * The 360px panel floor, which is the width this actually ships at (ADR-0030).
 * The band's controls wrap rather than overflowing the card.
 */
export const NarrowWithBand: Story = {
  args: WithBand.args,
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
};
