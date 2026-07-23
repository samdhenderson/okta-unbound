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
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The Users tab's lifecycle-actions panel plus its confirmation modal, gated by user status.\n\n" +
          'Offers only the actions valid for the current status — Suspend + Reset Password for ACTIVE, Unsuspend for SUSPENDED, and a notice (no actions) for DEPROVISIONED. Trigger buttons disable while an action is in flight; arming an action opens a confirmation modal that the parent commits. Presentational — the parent owns the pending-action state and the API call.',
      },
    },
  },
  args: {
    user: user(),
    isLifecycleLoading: false,
    pendingLifecycleAction: null,
    onRequestAction: fn(),
    onCancel: fn(),
    onConfirm: fn(),
  },
  argTypes: {
    user: { description: 'The selected user the actions apply to.' },
    isLifecycleLoading: {
      description: 'True while a confirmed action is in flight (disables the trigger buttons).',
    },
    pendingLifecycleAction: {
      description: 'The action awaiting confirmation, or null. Drives the confirm modal.',
    },
    onRequestAction: { description: 'Arm the confirm modal for an action.' },
    onCancel: { description: 'Dismiss the confirm modal without running the action.' },
    onConfirm: { description: 'Run the armed action (the confirm button).' },
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
