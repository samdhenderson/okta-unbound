import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import AlertMessage from './AlertMessage';

/** Inline alert/notification banner with status icon and optional dismiss + action. */
const meta = {
  title: 'Shared/AlertMessage',
  component: AlertMessage,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Inline alert/notification banner with a status icon and optional dismiss (×) button and inline action.\n\n' +
          'Colour and icon are driven by the canonical `StatusType` vocabulary (`success | warning | danger | info` — ADR-0002). Renders with `role="alert"`. A `danger` message forces its action button into destructive styling regardless of the action’s own `variant`.',
      },
    },
  },
  argTypes: {
    message: {
      description:
        'The alert text plus its `StatusType` severity, which selects the icon and colours.',
    },
    onDismiss: {
      description: 'When provided, renders a dismiss (×) button that invokes this callback.',
    },
    action: { description: 'Optional inline call-to-action button (e.g. “Retry”, “Undo”).' },
    className: { description: 'Extra classes merged onto the outer container.' },
  },
  args: {
    message: {
      text: 'This is an informational message.',
      type: 'info',
    },
    onDismiss: fn(),
  },
} satisfies Meta<typeof AlertMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default info-level message. */
export const Default: Story = {};

/** Success status with green styling. */
export const Success: Story = {
  args: {
    message: {
      text: 'Changes saved successfully.',
      type: 'success',
    },
  },
};

/** Warning status with amber styling. */
export const Warning: Story = {
  args: {
    message: {
      text: 'This action will affect multiple users.',
      type: 'warning',
    },
  },
};

/** Danger status with red styling. */
export const Danger: Story = {
  args: {
    message: {
      text: 'Failed to update user permissions.',
      type: 'danger',
    },
  },
};

/** With an inline action button. */
export const WithAction: Story = {
  args: {
    message: {
      text: 'Connection lost.',
      type: 'warning',
    },
    action: {
      label: 'Retry',
      onClick: fn(),
    },
  },
};

/** Danger message with danger-styled action button. */
export const DangerWithAction: Story = {
  args: {
    message: {
      text: 'This will delete all selected users.',
      type: 'danger',
    },
    action: {
      label: 'Confirm Delete',
      onClick: fn(),
      variant: 'danger',
    },
  },
};

/** Without dismiss button. */
export const NoDismiss: Story = {
  args: {
    message: {
      text: 'Information message without dismiss option.',
      type: 'info',
    },
    onDismiss: undefined,
  },
};
