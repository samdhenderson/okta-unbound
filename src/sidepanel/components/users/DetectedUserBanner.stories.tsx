import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import DetectedUserBanner from './DetectedUserBanner';

/** The Users tab's "detected in admin" banner with manual Load / Dismiss actions. */
const meta = {
  title: 'Users/DetectedUserBanner',
  component: DetectedUserBanner,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    userInfo: { userId: 'u1', userName: 'Ada Lovelace', userStatus: 'ACTIVE' },
    isLoading: false,
    onLoad: fn(),
    onDismiss: fn(),
  },
} satisfies Meta<typeof DetectedUserBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Active user detected — green status badge. */
export const Active: Story = {};

/** Deprovisioned user detected — danger status badge. */
export const Deprovisioned: Story = {
  args: { userInfo: { userId: 'u2', userName: 'Grace Hopper', userStatus: 'DEPROVISIONED' } },
};

/** Suspended user detected — warning status badge. */
export const Suspended: Story = {
  args: { userInfo: { userId: 'u3', userName: 'Alan Turing', userStatus: 'SUSPENDED' } },
};

/** No status available — the badge is omitted. */
export const NoStatus: Story = {
  args: { userInfo: { userId: 'u4', userName: 'Katherine Johnson' } },
};

/** A load/analysis is in flight — the Load button is disabled. */
export const Loading: Story = {
  args: { isLoading: true },
};
