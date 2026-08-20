import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import DetectedUserBanner from './DetectedUserBanner';

/** The Users tab's "open in admin" banner: one line, one Load verb, one dismiss. */
const meta = {
  title: 'Users/DetectedUserBanner',
  component: DetectedUserBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Presentational "open in admin" banner for the Users tab.\n\n' +
          'Shown when the Okta admin page has a user open that differs from the one explicitly selected in the tab. Loading is MANUAL only — the Load button — so admin navigation never hijacks the tab; all visibility/dismiss logic lives in the parent and this component only forwards Load / Dismiss intent.\n\n' +
          'It is one row: an `Eyebrow` naming the source, then `{name} · {STATUS}`, then a single `primary` Load and an `IconButton` to dismiss. It previously offered two equal-weight buttons (a `secondary` Load beside a `ghost` Dismiss), so nothing said which one the banner was for, and it carried a hand-rolled status pill built from a nested ternary — the third element on a line trying to be one line.',
      },
    },
  },
  args: {
    userInfo: { userId: '00uFAKE0001', userName: 'Ada Lovelace', userStatus: 'ACTIVE' },
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

/** An active user is open in the admin console. */
export const Active: Story = {};

/** A deprovisioned user — the status is stated in the line, not in a pill of its own. */
export const Deprovisioned: Story = {
  args: {
    userInfo: { userId: '00uFAKE0002', userName: 'Grace Hopper', userStatus: 'DEPROVISIONED' },
  },
};

/** A suspended user. */
export const Suspended: Story = {
  args: { userInfo: { userId: '00uFAKE0003', userName: 'Alan Turing', userStatus: 'SUSPENDED' } },
};

/** No status available — the line is just the name. */
export const NoStatus: Story = {
  args: { userInfo: { userId: '00uFAKE0004', userName: 'Katherine Johnson' } },
};

/** A load/analysis is in flight — the Load button is disabled. */
export const Loading: Story = {
  args: { isLoading: true },
};

/**
 * A long name at full width: the name truncates so the Load verb and the dismiss
 * control keep their place rather than being pushed off the row.
 */
export const LongName: Story = {
  args: {
    userInfo: {
      userId: '00uFAKE0005',
      userName: 'Bartholomew Featherstonehaugh-Wintergreen',
      userStatus: 'LOCKED_OUT',
    },
  },
};

/** The same long name at 360px, where the row has the least width to give. */
export const Compact360: Story = {
  args: {
    userInfo: {
      userId: '00uFAKE0005',
      userName: 'Bartholomew Featherstonehaugh-Wintergreen',
      userStatus: 'LOCKED_OUT',
    },
  },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
