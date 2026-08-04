import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import Button from './Button';
import Modal from './Modal';

/** Accessible modal dialog — focus trap, Escape-to-close, focus restoration. */
const meta = {
  title: 'Shared/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Accessible modal dialog — the canonical overlay for all pop-up UI.\n\n' +
          'Provides `role="dialog"` + `aria-modal`, a Tab focus-trap, autofocus into the panel, focus restoration on close, and Escape / overlay-click to dismiss. Four width presets (`sm | md | lg | xl`) and an optional footer bar for action buttons. Renders nothing when `isOpen` is false. Always use this rather than a bespoke overlay.\n\n' +
          'Closing is animated: the panel is held in the DOM for one exit animation, but is `aria-hidden` + `inert` for that window and focus returns to the trigger immediately — so `isOpen === false` means "gone" to every consumer from the first frame. Under `prefers-reduced-motion` the hold is skipped entirely. See the **Motion Showcase** story.',
      },
    },
  },
  argTypes: {
    isOpen: {
      description:
        'When false the modal closes — the panel is held for its exit animation (hidden from the accessible tree), then unmounted.',
    },
    onClose: { description: 'Invoked on Escape, overlay click, or the header close button.' },
    title: { description: 'Dialog title; wired to `aria-labelledby`.' },
    children: { description: 'Body content.' },
    footer: {
      description: 'Optional footer node (typically action buttons), shown in a styled footer bar.',
    },
    size: { description: 'Max-width preset for the panel. Defaults to `md`.' },
  },
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

/**
 * Toggle harness for the motion showcase — the exit animation only exists on a
 * real `true → false` transition, so it needs owned state rather than an arg.
 */
const ExitDemo: React.FC<React.ComponentProps<typeof Modal>> = (args) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      <Modal
        {...args}
        isOpen={open}
        onClose={() => setOpen(false)}
        footer={
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        }
      />
    </div>
  );
};

/**
 * Motion showcase — open it, then dismiss with Escape, the overlay, or Cancel to
 * watch the exit. Entrance and exit are the `overlay-in`/`panel-in` and
 * `overlay-out`/`panel-out` animations; the exit is one step faster than the
 * entrance. The rest of the story suite runs with motion suppressed, so this is
 * the one place the transition is visible — and it deliberately has no `play`
 * function, which would race the animation.
 */
export const MotionShowcase: Story = {
  parameters: { motion: 'on' },
  args: {
    title: 'Confirm removal',
    children: <p>Closing this dialog animates it out; focus returns to the trigger at once.</p>,
  },
  render: (args) => <ExitDemo {...args} />,
};
