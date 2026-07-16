import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import Button from './Button';
import Modal from './Modal';

/** Accessible modal dialog — focus trap, Escape-to-close, focus restoration. */
const meta = {
  title: 'Shared/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    isOpen: true,
    onClose: fn(),
    title: 'Modal Title',
    children: <p>Modal content goes here.</p>,
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Basic modal with content only. */
export const Default: Story = {};

/** With a footer containing action buttons. */
export const WithFooter: Story = {
  args: {
    children: <p>Are you sure you want to delete this item? This action cannot be undone.</p>,
    title: 'Confirm deletion',
    footer: (
      <>
        <Button variant="ghost" onClick={fn()}>
          Cancel
        </Button>
        <Button variant="danger" onClick={fn()}>
          Delete
        </Button>
      </>
    ),
  },
};

/** Small size variant. */
export const Small: Story = {
  args: {
    size: 'sm',
    title: 'Small modal',
  },
};

/** Large size variant. */
export const Large: Story = {
  args: {
    size: 'lg',
    title: 'Large modal',
  },
};

/** Extra-large size variant. */
export const ExtraLarge: Story = {
  args: {
    size: 'xl',
    title: 'Extra-large modal',
  },
};

/** With long scrollable content. */
export const WithLongContent: Story = {
  args: {
    title: 'Terms and Conditions',
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat.
        </p>
        <p>
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
          nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia
          deserunt mollit anim id est laborum.
        </p>
        <p>
          Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque
          laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi
          architecto beatae vitae dicta sunt explicabo.
        </p>
        <p>
          Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia
          consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
        </p>
      </div>
    ),
    footer: <Button variant="primary">Accept</Button>,
  },
};

/** Closed state (renders nothing). */
export const Closed: Story = {
  args: {
    isOpen: false,
  },
};
