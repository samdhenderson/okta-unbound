import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import UserLifecycleActions from './UserLifecycleActions';
import { mockUsers } from '../../../test/mocks/handlers';
import type { OktaUser } from '../../../shared/types';

const user = (over: Partial<OktaUser> = {}): OktaUser => ({
  ...mockUsers[10],
  status: 'ACTIVE',
  ...over,
});

/** The Users tab's lifecycle-actions panel + confirmation modal (status-gated). */
const meta = {
  title: 'Users/UserLifecycleActions',
  component: UserLifecycleActions,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    user: user(),
    isLifecycleLoading: false,
    pendingLifecycleAction: null,
    onRequestAction: fn(),
    onCancel: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof UserLifecycleActions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ACTIVE user: Suspend + Reset Password are offered. */
export const Active: Story = {};

/** SUSPENDED user: only Unsuspend is offered. */
export const Suspended: Story = {
  args: { user: user({ status: 'SUSPENDED' }) },
};

/** DEPROVISIONED user: no actions available, just the notice. */
export const Deprovisioned: Story = {
  args: { user: user({ status: 'DEPROVISIONED' }) },
};

/** An action is in flight — the trigger buttons are disabled. */
export const Loading: Story = {
  args: { isLifecycleLoading: true },
};

/** The suspend action is armed — the confirmation modal is open. */
export const ConfirmingSuspend: Story = {
  args: { pendingLifecycleAction: 'suspend' },
};

/** The reset-password action is armed — the confirmation modal is open. */
export const ConfirmingResetPassword: Story = {
  args: { pendingLifecycleAction: 'resetPassword' },
};
