import type { Meta, StoryObj } from '@storybook/react-vite';
import Header from './Header';

/** Fixed top app header showing the product name and a colour-coded connection status. */
const meta = {
  title: 'Sidepanel/Header',
  component: Header,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    status: 'connected',
  },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Connected to the Okta tab — green status dot. */
export const Default: Story = {};

/** Establishing the connection — pulsing amber dot. */
export const Connecting: Story = {
  args: { status: 'connecting' },
};

/** Connection lost or failed — red status dot. */
export const Error: Story = {
  args: { status: 'error' },
};
