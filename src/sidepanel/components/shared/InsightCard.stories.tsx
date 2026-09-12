import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import InsightCard from './InsightCard';
import Badge from './Badge';

/**
 * The card anatomy every insights surface shares — name, badges, headline,
 * one disclosure.
 */
const meta = {
  title: 'Shared/InsightCard',
  component: InsightCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The anatomy every card on an insights surface shares: a name, the badges saying why it ranks where it does, a headline that reads without a click, and one disclosure holding the detail.\n\n' +
          'Extracted from `AttributeHealthCard`, which was the only card with this shape until the MFA coverage scan grew from one sentence into a pair of reports. The two now describe different subjects with the same anatomy, which is the point: a reader learns one card and reads the whole surface with it.\n\n' +
          '**One anatomy, ranked.** Severity is carried by *order* and by *badges*, never by giving a flagged card a different shape. A second shape for "bad" cards would mean a reader learns two layouts and then has to diff them.\n\n' +
          '**The badges survive the collapse.** They render in both stages. A collapsed card that hid its reasons would leave the ranking looking arbitrary — the reader sees an order with no visible cause and has to open cards to find out why.\n\n' +
          '**The disclosure is a real control.** A `StretchedButton` scoped to the header carries `aria-expanded`/`aria-controls`; it is focusable and Enter/Space operable. Scoping it to the header (not the whole card) is what stops a click inside the body from collapsing the card it just opened. The body stays mounted and `inert` while closed, so nothing inside it resets.\n\n' +
          "**The control's name carries its subject.** A surface renders a grid of these, and `aria-describedby` is a description rather than a name — so without the subject every card's control would be called the same thing in a list of names.",
      },
    },
  },
  argTypes: {
    title: {
      description:
        "Render prop for the card's name, given the `titleId` the disclosure points at. A `<code>` for an attribute key, plain text for a report.",
    },
    subject: {
      description:
        "Plain-text subject for the disclosure's accessible name, e.g. `department`. Required — a grid of these otherwise names every control identically.",
    },
    revealName: {
      description:
        'What the disclosure reveals, as a noun phrase. Composed into "Show the {revealName} for {subject}".',
    },
    badges: {
      description:
        'Why this card ranks where it does. Rendered in every stage, collapsed included. Omit when nothing is flagged — an empty strip is an answer, and renders as no strip.',
    },
    headline: {
      description:
        'The always-visible summary under the badges — a spread bar, a count line, or both. This is what a collapsed card is read for.',
    },
    children: { description: 'The disclosed body.' },
    defaultExpanded: {
      description:
        'Starts the card expanded. For stories and tests; surfaces open cards on demand.',
    },
  },
  args: {
    title: (titleId: string) => (
      <span id={titleId} className="truncate text-sm font-semibold text-neutral-900">
        Enrollment
      </span>
    ),
    subject: 'MFA enrollment',
    revealName: 'bucket breakdown',
    badges: (
      <ul className="flex flex-wrap gap-1.5">
        <li>
          <Badge variant="warning">2 unprotected</Badge>
        </li>
        <li>
          <Badge variant="neutral">7 on a single factor</Badge>
        </li>
      </ul>
    ),
    headline: <p className="text-xs text-neutral-600">40 of 40 members scanned · 3 buckets</p>,
    children: (
      <ul className="space-y-1 text-xs text-neutral-700">
        <li>No factors enrolled — 2 (5%)</li>
        <li>One factor — 7 (18%)</li>
        <li>Two or more factors — 31 (78%)</li>
      </ul>
    ),
  },
} satisfies Meta<typeof InsightCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** How a card arrives: name, badges and headline, with the detail folded away. */
export const Collapsed: Story = {};

/** The disclosure open, showing the body. */
export const Expanded: Story = {
  args: { defaultExpanded: true },
};

/**
 * Nothing is flagged about this one. The badge strip is omitted rather than
 * rendered empty — an empty strip is an answer, not a gap.
 */
export const NoBadges: Story = {
  args: {
    title: (titleId: string) => (
      <span id={titleId} className="truncate text-sm font-semibold text-neutral-900">
        Factor types
      </span>
    ),
    subject: 'factor types',
    revealName: 'factor list',
    badges: undefined,
    headline: <p className="text-xs text-neutral-600">4 types in use</p>,
  },
};

/**
 * The header overlay is a real `<button>`: reachable by Tab, toggled by Enter,
 * and it names its subject rather than saying "Expand".
 */
export const KeyboardOperable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: 'Show the bucket breakdown for MFA enrollment',
    });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.tab();
    expect(trigger).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(
      canvas.getByRole('button', { name: 'Hide the bucket breakdown for MFA enrollment' }),
    ).toHaveAttribute('aria-expanded', 'true');
  },
};

/** Two cards side by side, which is how the MFA coverage section reads. */
export const InAGrid: Story = {
  render: (args) => (
    <div className="grid grid-cols-1 gap-3 bg-canvas p-3 sm:grid-cols-2">
      <InsightCard {...args} />
      <InsightCard {...args} {...NoBadges.args} />
    </div>
  ),
};
