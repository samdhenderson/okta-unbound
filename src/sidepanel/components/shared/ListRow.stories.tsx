import type { Meta, StoryObj } from '@storybook/react-vite';
import ListRow from './ListRow';

/**
 * The card a list row sits in — border, radius, hover, padding, state. Owns the
 * box, never the interior.
 */
const meta = {
  title: 'Shared/ListRow',
  component: ListRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The chrome every list row shares, in one place (ADR-0029).\n\n' +
          'Before this existed the same conceptual element shipped ten padding values, ' +
          'five hover treatments and four separator strategies, with class strings ' +
          'hand-copied between files. `ListRow` fixes the radius, resting border, hover ' +
          'border and transition — there is deliberately no prop to change them — and ' +
          'exposes only `density`, `state`, `flash` and `as`.\n\n' +
          'It does **not** own the interior: children are whatever the feature needs, ' +
          'because interiors genuinely differ (a checkbox and a disclosure body versus ' +
          'three lines of text). The interior instead follows the typography contract in ' +
          '`docs/design-system.md`.\n\n' +
          'Prefer `StretchedButton` over `as="button"` when the row contains its own ' +
          'controls — a button cannot legally contain a checkbox or another button.',
      },
    },
  },
  argTypes: {
    children: { description: "The row's content, owned by the feature." },
    density: {
      description: 'Padding scale: `compact` (px-3 py-2) or `comfortable` (p-4).',
    },
    state: { description: 'Resting appearance: `default`, `selected`, or `highlighted`.' },
    flash: { description: 'One-shot success confirmation via `animate-affirm-flash`.' },
    as: { description: 'Element to render: `div`, `li`, `a`, or `button`.' },
    onClick: { description: 'Activation handler; supplying it makes the row interactive.' },
    href: { description: '`href` for `as="a"`.' },
    target: { description: 'Link target; `_blank` also sets `rel="noopener noreferrer"`.' },
    ariaLabel: { description: 'Accessible name when the content does not supply one.' },
    describedBy: { description: '`id` of the element describing this row.' },
    dataAttributes: { description: 'Row-identity attributes (`data-group-id`, …).' },
    className: { description: 'Extra classes — layout only, never colour.' },
    testId: { description: 'Test id applied to the row element.' },
  },
  args: {
    children: null,
  },
} satisfies Meta<typeof ListRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A row's interior, in the typography the contract specifies. */
const RowBody = ({ title = 'Engineering', meta: metaLine = 'Okta group · 248 members' }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-semibold text-neutral-900">{title}</div>
      <div className="mt-0.5 truncate text-xs text-neutral-600">{metaLine}</div>
    </div>
    <span className="shrink-0 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-600">
      Active
    </span>
  </div>
);

/** The default: comfortable padding, resting state. */
export const Default: Story = {
  args: {
    children: <RowBody />,
  },
};

/**
 * Both densities together — the comparison that makes drift visible.
 *
 * These are the only two values. Rows that previously sat between them (`p-3`,
 * `px-2.5 py-1.5`, `p-5`) round to the nearer one.
 */
export const Densities: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="space-y-3">
      <ListRow density="compact">
        <RowBody title="compact — px-3 py-2" meta="Dense scanning list" />
      </ListRow>
      <ListRow density="comfortable">
        <RowBody title="comfortable — p-4" meta="Rich card with badges and a meta line" />
      </ListRow>
    </div>
  ),
};

/**
 * All three resting states.
 *
 * `selected` is a user choice and persists; `highlighted` is a transient
 * deep-link target the app scrolled to. They are distinct because a highlight
 * fades and a selection does not.
 */
export const States: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="space-y-3">
      <ListRow state="default">
        <RowBody title="default" meta="Resting" />
      </ListRow>
      <ListRow state="selected">
        <RowBody title="selected" meta="A user choice — persists" />
      </ListRow>
      <ListRow state="highlighted">
        <RowBody title="highlighted" meta="A deep-link target — transient" />
      </ListRow>
    </div>
  ),
};

/**
 * Interactive rows carry a pointer cursor and a focus ring.
 *
 * Tab to this row: the ring is `focus-visible`, so it appears for keyboard users
 * and not on click. This is the affordance five components were missing entirely
 * as bare `<div onClick>` — see ADR-0029.
 */
export const Interactive: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="space-y-3">
      <ListRow as="button" onClick={() => {}} ariaLabel="Open Engineering">
        <RowBody title='as="button"' meta="Whole row activates — keyboard reachable" />
      </ListRow>
      <ListRow as="a" href="#list-row-demo" target="_blank">
        <RowBody title='as="a"' meta="Real navigation — rel is set automatically" />
      </ListRow>
    </div>
  ),
};

/**
 * Inside a `<ul>`, as `as="li"`.
 *
 * One of the two sanctioned separator patterns: `space-y-3` with a bordered row.
 * The other — `divide-y` inside a single bordered container — is for dense
 * table-like surfaces and opts out of the per-row border.
 */
export const InAList: Story = {
  args: {
    children: null,
  },
  render: () => (
    <ul className="space-y-3">
      {['Engineering', 'Design', 'Support'].map((name) => (
        <ListRow key={name} as="li" density="compact">
          <RowBody title={name} meta="Okta group" />
        </ListRow>
      ))}
    </ul>
  ),
};

/**
 * An expandable row, via the `body` slot.
 *
 * The border belongs to the card, the padding belongs to the header, and the body
 * sets its own — which is why `body` exists rather than the row being simply "a
 * padded box". Passing it moves the density padding onto an inner wrapper and
 * clips the card, so a `.disclose` body animating from `0fr` cannot escape the
 * rounded corners. Four of the six primary list rows need this.
 */
export const Expandable: Story = {
  args: {
    children: null,
  },
  render: () => (
    <ListRow
      body={
        <div className="disclose" data-open="true">
          <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-xs text-neutral-600">
              Body content sets its own padding and can carry its own background — the header above
              keeps the density padding.
            </p>
          </div>
        </div>
      }
    >
      <RowBody title="Expandable row" meta="Header keeps p-4; body sets its own" />
    </ListRow>
  ),
};

/**
 * `card` versus `nested` — the two idioms, side by side.
 *
 * A `nested` row sits inside something that is already a card, so it draws no
 * border (a box inside a box is noise) and separates on hover background instead.
 * It also runs `tight`, because the containing card already pays for one level of
 * padding. Four rows were hand-rolling this recipe with three different paddings.
 */
export const Variants: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="space-y-4">
      <ListRow density="compact">
        <RowBody title="card" meta="Carries its own border" />
      </ListRow>

      {/* The container a nested row lives in — this is the card. */}
      <div className="rounded-md border border-neutral-200 bg-white p-3">
        <div className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
          Recent groups
        </div>
        {['Engineering', 'Design', 'Support'].map((name) => (
          <ListRow key={name} variant="nested" density="tight">
            <RowBody title={name} meta="No border — hover separates it" />
          </ListRow>
        ))}
      </div>
    </div>
  ),
};

/** A one-shot success confirmation on a row that was just added or changed. */
export const Flash: Story = {
  args: {
    flash: true,
    children: <RowBody title="Just added" meta="animate-affirm-flash" />,
  },
};
