import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import StretchedButton from './StretchedButton';
import IconButton from './IconButton';
import Checkbox from './Checkbox';
import Icon from '../shared/Icon';

/** Invisible full-bleed button that makes an enclosing card or row activatable. */
const meta = {
  title: 'Shared/StretchedButton',
  component: StretchedButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The "stretched link" pattern, as a real `<button>`: an empty, absolutely-positioned button that covers its positioned ancestor so clicking anywhere on a card opens it.\n\n' +
          'It exists to avoid the two usual bad answers — `role="button"` on a `<div>` (which has to re-implement Enter/Space, focus and disabled semantics) and wrapping the card in a `<button>` (invalid content model, and an axe `nested-interactive` violation the moment the card has its own controls).\n\n' +
          '**Layout contract:** the intended click target must be `relative`, and the card’s own controls must be `relative z-10` or they sit under the overlay. Because every card in a list shares one label, pass `describedBy` pointing at the element that names *this* card.',
      },
    },
  },
  argTypes: {
    label: { description: 'Accessible name — required, since the button has no visible content.' },
    onClick: { description: 'Activation handler.' },
    describedBy: {
      description: '`id` of the element that names this specific card (usually its title).',
    },
    title: { description: 'Tooltip text; defaults to `label`.' },
    disabled: { description: 'Disables activation.' },
    className: { description: 'Extra classes merged after the base positioning classes.' },
  },
  args: {
    label: 'View group details',
    onClick: fn(),
  },
} satisfies Meta<typeof StretchedButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * On its own the button is invisible, so it is only meaningful in context: this
 * is the group-row shape it was built for — a checkbox and an icon button lifted
 * above the overlay, with everything else plain content.
 */
export const Default: Story = {
  render: (args) => (
    <div className="relative w-80 rounded-md border border-neutral-200 bg-white px-3 py-2">
      <StretchedButton {...args} describedBy="stretched-demo-name" />
      <div className="flex items-center gap-2">
        <span className="relative z-10">
          <Checkbox checked={false} onChange={fn()} aria-label="Select Engineering" />
        </span>
        <h3 id="stretched-demo-name" className="text-sm font-semibold text-neutral-900">
          Engineering
        </h3>
        <span className="relative z-10 ml-auto">
          <IconButton label="Expand" size="sm">
            <Icon type="chevron-right" size="sm" />
          </IconButton>
        </span>
      </div>
      <p className="mt-0.5 text-xs text-neutral-600">
        Click anywhere on the card — except the two controls — to activate.
      </p>
    </div>
  ),
};

/**
 * Focus-visible state (forced via the pseudo-states addon): the overlay draws its
 * focus ring around the whole card, so a keyboard user can see what they are on.
 */
export const Focus: Story = {
  ...Default,
  parameters: { pseudo: { focusVisible: true } },
};

/** Disabled — the card is inert, but its own controls still work. */
export const Disabled: Story = {
  ...Default,
  args: { disabled: true },
};
