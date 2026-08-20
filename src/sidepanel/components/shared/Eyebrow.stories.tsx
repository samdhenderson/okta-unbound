import type { Meta, StoryObj } from '@storybook/react-vite';
import Eyebrow from './Eyebrow';
import Badge from './Badge';
import Button from './Button';

/**
 * The single home for the uppercase section-label recipe. Replaces roughly
 * eighteen hand-rolled copies written to four different recipes.
 */
const meta = {
  title: 'Shared/Eyebrow',
  component: Eyebrow,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The small uppercase label that titles a section — the one place the recipe `text-xs font-semibold uppercase tracking-wide text-neutral-600` lives.\n\n' +
          'Before this component the same element was hand-rolled in roughly eighteen files under four competing recipes: `tracking-wide` against `tracking-wider`, `text-xs` against the off-scale `text-[10px]` / `text-[11px]`, and `text-neutral-500` against `-600` against `-700`. Several sizes of the same element could appear on one screen.\n\n' +
          'ADR-0030 already settled the values — `DetailSection`’s `tracking-wide` eyebrow is named there as the survivor of the tracking-wide/tracking-wider split — but settled them in prose, so the drift kept accumulating. This component is that decision made mechanical.\n\n' +
          'There is deliberately **no colour, size or tracking prop**. A section wanting a different eyebrow treatment is exactly the drift this exists to stop; if a new treatment is genuinely needed it changes here, once, for everyone. `className` is for layout and spacing only.\n\n' +
          'An eyebrow is a **label, not a control**. A section header that needs a verb composes this beside a `Button` or `IconButton` — the label itself never becomes pressable.\n\n' +
          'Use `as="h3"` only when the eyebrow is a real section heading that should join the document outline; the default `span` keeps a decorative label out of heading order.',
      },
    },
  },
  argTypes: {
    children: {
      description:
        'The label text. Keep it short — an eyebrow titles a section, it does not explain it.',
    },
    as: {
      description:
        'Element to render: `span` (default), `div` for a block box, or `h3` when the eyebrow is a real section heading.',
    },
    className: {
      description: 'Extra classes — layout and spacing only, never colour or type.',
    },
    title: { description: 'Native `title` tooltip, for a label whose full meaning does not fit.' },
    testId: { description: 'Optional test handle.' },
  },
  args: {
    children: 'Membership source',
  },
} satisfies Meta<typeof Eyebrow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: a decorative `span` label carrying the one fixed recipe. */
export const Default: Story = {};

/**
 * All three elements render identically — `as` changes semantics, never the type.
 *
 * That is the whole point of the prop: a heading and a decorative label look the
 * same because they *are* the same recipe, and the choice between them is about
 * the document outline rather than appearance.
 */
export const Elements: Story = {
  parameters: {
    // heading-order disabled: this story renders an `h3` in isolation with no
    // surrounding page outline, so axe flags a heading that starts below h1.
    // The `as="h3"` case is the one worth showing, and the real call sites
    // supply the ancestor headings that make the order legal.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
  },
  render: () => (
    <div className="space-y-2">
      <Eyebrow as="span" className="block">
        span — decorative label
      </Eyebrow>
      <Eyebrow as="div">div — decorative block</Eyebrow>
      <Eyebrow as="h3">h3 — real section heading</Eyebrow>
    </div>
  ),
};

/**
 * In its real job: a section header, composed with the primitives that sit
 * beside it.
 *
 * The eyebrow names the section, a `Badge` counts it and a `Button` acts on it.
 * The label stays a label — the verb lives in the button, never in the heading.
 */
export const SectionHeader: Story = {
  parameters: {
    // heading-order disabled: an `h3` section heading rendered without the page
    // shell that would supply its `h1`/`h2` ancestors.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
  },
  render: () => (
    <div className="w-96 rounded-md border border-neutral-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Eyebrow as="h3">Members</Eyebrow>
          <Badge variant="neutral">248</Badge>
        </div>
        <Button variant="secondary" size="sm">
          Load
        </Button>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Everyone who resolves into this group, from every source.
      </p>
    </div>
  ),
};

/**
 * Stacked eyebrows in a fact list, the pattern that drifted most.
 *
 * Each label previously picked its own size and neutral step; here they are one
 * element repeated, so the column reads as a column.
 */
export const InAFactList: Story = {
  render: () => (
    <dl className="w-72 space-y-3">
      {[
        ['Group type', 'Okta group'],
        ['Source', 'Rule — Engineering EMEA'],
        ['Last updated', '19 Aug 2026'],
      ].map(([label, value]) => (
        <div key={label}>
          <dt>
            <Eyebrow>{label}</Eyebrow>
          </dt>
          <dd className="mt-0.5 text-sm text-neutral-900">{value}</dd>
        </div>
      ))}
    </dl>
  ),
};

/**
 * At 360px, the narrowest side-panel width.
 *
 * A long label wraps rather than truncating — an eyebrow is short by contract,
 * and the fixed `text-xs` means it never steals a line from the content it
 * titles the way an off-scale copy at `text-[11px]` did.
 */
export const Compact: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
  render: () => (
    <div className="w-full space-y-3 p-4">
      <Eyebrow className="block">Membership source breakdown</Eyebrow>
      <p className="text-sm text-neutral-700">
        248 members: 190 assigned directly, 58 from two rules.
      </p>
    </div>
  ),
};

/** A label whose full meaning does not fit, carrying the rest on `title`. */
export const WithTooltip: Story = {
  args: {
    children: 'App push',
    title: 'Where this group’s members are provisioned downstream.',
  },
};
