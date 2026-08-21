import React, { useCallback, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import Button from './Button';
import Modal, { MODAL_LAYER_ID } from './Modal';

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

/**
 * Interaction test for the exit mount-hold. Runs with motion suppressed (the
 * suite default), where the exit animation collapses to `1ms` but still fires
 * `animationend` — so this exercises the event-driven release of the hold, which
 * jsdom cannot (it never runs animations, leaving only the timeout fallback
 * covered there). The removal is asserted inside a window shorter than the
 * `EXIT_MS` fallback: if the event path regressed, the panel would linger past it
 * and this would fail rather than silently fall back.
 */
export const ExitInteraction: Story = {
  args: {
    title: 'Confirm removal',
    children: <p>This dialog is opened and dismissed by the interaction test.</p>,
  },
  render: (args) => <ExitDemo {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Open modal' });

    await userEvent.click(trigger);
    const dialog = await canvas.findByRole('dialog');

    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));

    // The hold releases and the panel leaves the DOM.
    await waitFor(() => expect(dialog.isConnected).toBe(false));
    expect(canvas.queryByRole('dialog')).toBeNull();

    // Focus went back to the trigger. This is the contract that matters: focus
    // restore is keyed on `isOpen`, not on the hold, so a keyboard user is never
    // stranded for the length of the exit.
    expect(document.activeElement).toBe(trigger);
  },
};

/**
 * Harness for the D-009 regression story: an app-shaped shell with a fixed bottom
 * band standing in for the `ActivityBar`, plus the modal layer the overlay portals
 * into.
 *
 * The modal opens only once the layer node is in the DOM — the order the real
 * shell produces, since `App` mounts with every modal closed and the user opens
 * one later. That is driven by the layer's own ref callback (which fires in the
 * commit that inserts the node) rather than an effect. Keeping the layer inside
 * the story canvas rather than on `document.body` means the canvas-scoped queries
 * and the story's axe run still reach the dialog.
 */
const OverActivityBar: React.FC<React.ComponentProps<typeof Modal>> = (args) => {
  const [open, setOpen] = useState(false);
  const openOnceLayerExists = useCallback(() => setOpen(true), []);

  return (
    <div className="h-screen bg-canvas">
      <Modal {...args} isOpen={open} onClose={() => setOpen(false)} />
      <div
        data-testid="activity-bar-stand-in"
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white px-5 py-2.5 text-xs text-neutral-700"
      >
        Idle · 0 queued — stands in for the fixed ActivityBar band
      </div>
      <div id={MODAL_LAYER_ID} ref={openOnceLayerExists} />
    </div>
  );
};

/**
 * Regression story for D-009. The `ActivityBar` is a `fixed bottom-0 z-50` band and
 * the overlay is `fixed inset-0 z-50` — the same rung of the ladder — so whichever
 * comes later in the document paints on top. The bar used to, covering the bottom
 * of any open modal including its footer actions; the overlay now portals into the
 * shell's modal layer, which is mounted after the scroll root the bar lives in.
 *
 * The content is deliberately long so the panel reaches its `max-h` and its footer
 * sits in the band the bar occupies — the overlap the bug was visible in.
 */
export const OverTheActivityBar: Story = {
  args: {
    title: 'Confirm removal',
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Array.from({ length: 12 }, (_, i) => (
          <p key={i}>
            Removing this group takes its {i + 1} members with it. Scroll to the end to confirm —
            the footer actions must stay clickable over the activity bar.
          </p>
        ))}
      </div>
    ),
    footer: (
      <>
        <Button variant="ghost">Cancel</Button>
        <Button variant="danger">Confirm</Button>
      </>
    ),
  },
  render: (args) => <OverActivityBar {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = await canvas.findByRole('dialog');
    const activityBar = canvas.getByTestId('activity-bar-stand-in');

    // Later in the document at an equal z-index = painted on top.
    await expect(
      Boolean(
        activityBar.compareDocumentPosition(dialog) & activityBar.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);

    // Real layout, real hit testing: whatever is under the footer's primary action
    // has to be that button, not the bar.
    const confirm = canvas.getByRole('button', { name: 'Confirm' });
    const box = confirm.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    await expect(confirm.contains(hit)).toBe(true);
  },
};
