import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import Button from './Button';

/**
 * The primary text button primitive — five variants, four sizes, optional
 * icon/loading/badge. Prefer this over a hand-rolled `<button>`.
 */
const meta = {
  title: 'Shared/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The primary text button primitive — the default choice for any clickable CTA.\n\n' +
          'Five variants (`primary | secondary | danger | ghost | success`) and four sizes (`xs | sm | md | lg`), with an optional leading/trailing icon, loading spinner, trailing count badge, and full-width layout. Disabled and loading both block interaction. For icon-only affordances use `IconButton`; for filter toggles use `FilterPill`.',
      },
    },
  },
  argTypes: {
    children: { description: 'Button label content.' },
    variant: {
      description:
        'Visual treatment: `secondary` is the default; `danger`/`success` carry semantic colour; `ghost` is chromeless; `primary` is the page call to action.',
    },
    size: {
      description:
        'Size scale (`xs` ≈ 24px, `sm` ≈ 36px, `md` ≈ 40px, `lg` ≈ 56px). Defaults to `md`. `xs` is the recessed step — selection-register furniture, not a page verb.',
    },
    icon: {
      description: 'Optional icon glyph rendered alongside the label (hidden while `loading`).',
    },
    iconPosition: { description: 'Which side of the label the icon sits on. Defaults to `left`.' },
    disabled: { description: 'Disables the button.' },
    loading: {
      description: 'Shows a spinner and disables the button while an action is in flight.',
    },
    onClick: { description: 'Click handler.' },
    type: { description: 'Native button type. Defaults to `button` (does not submit forms).' },
    className: { description: 'Extra classes merged onto the button.' },
    fullWidth: { description: 'Stretch to fill the container width.' },
    badge: {
      description: 'Optional count/badge pill rendered at the trailing edge (e.g. unread count).',
    },
    title: { description: 'Native `title` tooltip.' },
  },
  args: {
    children: 'Add group',
    onClick: fn(),
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default (secondary) treatment. */
export const Default: Story = {};

/** The high-emphasis call to action. */
export const Primary: Story = {
  args: { variant: 'primary', icon: 'plus' },
};

/** Destructive action styling. */
export const Danger: Story = {
  args: { variant: 'danger', children: 'Remove members' },
};

/** Low-emphasis, chromeless. */
export const Ghost: Story = {
  args: { variant: 'ghost' },
};

/** Disabled state. */
export const Disabled: Story = {
  args: { disabled: true },
};

/** Spinner shown while an action is in flight (also disables the button). */
export const Loading: Story = {
  args: { variant: 'primary', loading: true },
};

/** Trailing count badge. */
export const WithBadge: Story = {
  args: { variant: 'primary', badge: '3' },
};

/** Hover state (forced via the pseudo-states addon). */
export const Hover: Story = {
  args: { variant: 'primary' },
  parameters: { pseudo: { hover: true } },
};

/** Focus-visible state (forced via the pseudo-states addon). */
export const Focus: Story = {
  args: { variant: 'primary' },
  parameters: { pseudo: { focusVisible: true } },
};

/**
 * Pressed state (forced via the pseudo-states addon): `.press`'s `scale(.955)`
 * depress plus `active:brightness-90`, the third, darker background step beyond
 * hover (ADR-0046).
 */
export const Pressed: Story = {
  args: { variant: 'primary' },
  parameters: { pseudo: { active: true } },
};

/**
 * The four size steps side by side. `xs` (24px) is deliberately smaller than a
 * button looks: it is for controls that are furniture around a list — the
 * `ActionBar` selection register — and it should never carry a page's own verb.
 */
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button {...args} size="xs">
        Extra small
      </Button>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
  args: { variant: 'primary' },
};

/**
 * A labelled **disclosure** trigger: `expanded` + `controls` put `aria-expanded`
 * and `aria-controls` on the button, so the region it shows is reachable from it.
 * The same pair `IconButton` carries for icon-only chevrons.
 */
export const Disclosure: Story = {
  render: (args) => (
    <div>
      <Button {...args} expanded controls="button-disclosure-region" icon="minus">
        Manage
      </Button>
      <div
        id="button-disclosure-region"
        className="mt-2 rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700"
      >
        The region this button shows and hides.
      </div>
    </div>
  ),
  args: { variant: 'ghost', size: 'sm' },
};
