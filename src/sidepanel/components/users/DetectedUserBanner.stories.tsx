import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import DetectedUserBanner from './DetectedUserBanner';

/** The Users tab's "detected in admin" banner with manual Load / Dismiss actions. */
const meta = {
  title: 'Users/DetectedUserBanner',
  component: DetectedUserBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Presentational "detected in admin" banner for the Users tab.\n\n' +
          'Shown when the Okta admin page has a user open that differs from the one explicitly selected in the tab. Renders the detected user with a status-colored badge (success / warning / danger, omitted when no status is known). Loading is MANUAL only — the Load button — so admin navigation never hijacks the tab; all visibility/dismiss logic lives in the parent and this component only forwards Load / Dismiss intent.',
      },
    },
  },
  args: {
    userInfo: { userId: 'u1', userName: 'Ada Lovelace', userStatus: 'ACTIVE' },
    isLoading: false,
    onLoad: fn(),
    onDismiss: fn(),
  },
  argTypes: {
    userInfo: { description: 'The user detected on the current Okta admin page.' },
    isLoading: { description: 'Disables the Load button while a load/analysis is in flight.' },
    onLoad: { description: 'Load the detected user + their memberships into the tab.' },
    onDismiss: { description: 'Dismiss the banner without loading.' },
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
