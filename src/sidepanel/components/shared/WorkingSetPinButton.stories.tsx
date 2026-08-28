import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import WorkingSetPinButton from './WorkingSetPinButton';

const meta = {
  title: 'Shared/WorkingSetPinButton',
  component: WorkingSetPinButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The pin that keeps an entity on the Home tab. It lives in the bottom-right corner of ' +
          '`PageHeader`, via that component’s `cornerAction` slot.\n\n' +
          '**It carries no visible label**, for two reasons. The header’s job is to describe the ' +
          'entity, and a worded button competing with the title would make a small optional ' +
          'convenience look like the page’s main verb. And `ContextBar` already has a control ' +
          'called **Pin** — freeze the panel on the detected Okta page — so a second visible "Pin" ' +
          'would be two different meanings of one word in one panel.\n\n' +
          'Its accessible name resolves that instead of dodging it: *Pin to Home* names the ' +
          'destination rather than the action, so a screen-reader user can tell the two apart even ' +
          'though a sighted user never sees either word.\n\n' +
          'One button in two states rather than two buttons, so it reports `aria-pressed` and the ' +
          'state is announced as a state.',
      },
    },
  },
  argTypes: {
    pinned: { description: 'Whether the entity is currently on Home.' },
    onToggle: { description: 'Pin it, or release it.' },
    disabled: {
      description:
        'Held while the entity is still resolving — a pin taken before the name arrives would put a row on Home reading a raw id.',
    },
  },
  args: { pinned: false, onToggle: fn() },
} satisfies Meta<typeof WorkingSetPinButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Not pinned. The accessible name says where pressing it puts the entity. */
export const Unpinned: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Pin to Home' });
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  },
};

/** Already on Home — the same button, pressed. */
export const Pinned: Story = {
  args: { pinned: true },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Unpin from Home' });
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  },
};

/** Held until the entity has a name to record. */
export const Disabled: Story = {
  args: { disabled: true },
};
