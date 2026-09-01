import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import PaletteRow from './PaletteRow';

/** One row in the ⌘K palette's result list. */
const meta = {
  title: 'Sidepanel/Palette/PaletteRow',
  component: PaletteRow,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One row in the ⌘K palette's result list — a section to jump to, or an entity to open.\n\n" +
          '**§3 exception — a raw `<button>`.** A palette row is a left-aligned icon + label + trailing-mark row carrying a roving `tabIndex` and a ref for programmatic focus. `Button` is a centred CTA and exposes neither. `ListRow` exposes `elementRef` — half of what is needed — but no `tabIndex` and no `onKeyDown`, so it cannot carry the roving anchor or the Up/Down handler either. The gap is structural rather than stylistic against both primitives, so a new variant would not discharge it. See `docs/components.md` §3.\n\n' +
          "**Button or link, never both.** A row whose kind this build cannot open in-panel has one route left — the Okta admin console — and that route is the whole row. Given an `href` the row renders as an `<a>`; otherwise as a `<button>`. A link nested inside the row button is a `nested-interactive` axe violation, and a button wrapping a working link is a control that does nothing (ADR-0039). `home/JumpResultRow` makes the same call with `as={onSelect ? 'button' : 'div'}`. Both forms are focusable and take the same roving `tabIndex`, so the list's Up/Down arithmetic stays a plain walk over its rows.\n\n" +
          '**The roving anchor lives in the list, not the row.** Exactly one row carries `tabIndex={0}` and every other carries `-1`, so the whole result list is one tab stop. The row takes the value it is told and a ref the list focuses; it owns none of that state.\n\n' +
          '`press-subtle` rather than `press` (ADR-0046): the row spans the full palette width, so a button-scale depress would read as a lurch.',
      },
    },
  },
  argTypes: {
    trailing: {
      control: false,
      description:
        'Right-edge mark. The palette uses it to name where a row goes (`Groups ›`), or to carry an "Open in Okta" link when a kind is unreachable — so a row that cannot navigate still has a route.',
    },
    isCurrent: {
      description:
        'Whether this is the section the reader is already on. Marks the row `aria-current="page"`, so the palette says where you are rather than only where you could go.',
    },
    tabIndex: {
      description: 'The roving anchor: `0` on exactly one row in the list, `-1` on every other.',
    },
  },
  args: {
    icon: 'users',
    label: 'Groups',
    tabIndex: 0,
    onClick: fn(),
  },
} satisfies Meta<typeof PaletteRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A section row: glyph and label, nothing else to say. */
export const Default: Story = {};

/** The section the reader is already on — tinted, marked, and named in words. */
export const Current: Story = {
  args: { label: 'Home', icon: 'home', isCurrent: true },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('button');
    // The tint is not the signal — `aria-current` is what a screen reader hears.
    await expect(row).toHaveAttribute('aria-current', 'page');
  },
};

/** An entity row: the second line carries the one extra fact worth showing. */
export const WithSecondary: Story = {
  args: { label: 'Engineering', secondary: 'Everyone in the engineering org' },
};

/**
 * An entity row that names its destination, so pressing it is never a surprise.
 */
export const WithTrailingMark: Story = {
  args: {
    label: 'Engineering',
    secondary: 'Everyone in the engineering org',
    trailing: 'Groups ›',
    ariaLabel: 'Engineering — open in Groups',
  },
  play: async ({ canvasElement }) => {
    // "Engineering" alone does not say where the row goes; the accessible name does.
    await expect(
      within(canvasElement).getByRole('button', { name: 'Engineering — open in Groups' }),
    ).toBeInTheDocument();
  },
};

/** Off the roving anchor: in the list, but not a tab stop. */
export const NotTheAnchor: Story = {
  args: { label: 'Rules', icon: 'bolt', tabIndex: -1 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button')).toHaveAttribute('tabindex', '-1');
  },
};

/**
 * The unreachable case: the row *is* the link out to Okta.
 *
 * Nothing is nested — the anchor replaces the button rather than sitting inside
 * it, which is what keeps the row out of `nested-interactive`.
 */
export const AsLink: Story = {
  args: {
    label: 'Engineering',
    secondary: 'All engineers',
    href: 'https://example.okta.com/admin/group/00gFAKE0000000000001',
    trailing: 'Okta ↗',
    ariaLabel: 'Engineering — open in Okta',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link', { name: 'Engineering — open in Okta' });

    // A new tab needs `noopener`: the Okta console must never get a handle on
    // the opener document.
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    // Not a button wrapping a link, and not a link wrapping a button.
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};

/** A long name and a long second line, at the panel's narrowest. */
export const Truncated: Story = {
  args: {
    label: 'Contractors — EMEA — Finance and Procurement (managed by IAM)',
    secondary: 'Sourced from the HR feed; membership is rule-driven and cannot be edited by hand',
    trailing: 'Groups ›',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
};
