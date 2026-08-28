import type { Meta, StoryObj } from '@storybook/react-vite';
import Icon from './Icon';
import Tooltip from './Tooltip';

/** Hover- and focus-triggered label chip for a control that does not name itself. */
const meta = {
  title: 'Shared/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Hover- and focus-triggered label chip for a control whose own rendering does not name it.\n\n' +
          'Replaces the native `title` attribute, which cannot be styled, fires on an uncontrollable delay, and never appears for a keyboard user. This one opens on hover **and** on focus after `--dur-hover-intent` (400ms), carries `role="tooltip"` wired to its trigger with `aria-describedby`, and closes on Escape, blur, pointer-leave, or any scroll that would move the trigger out from under it. It traps no focus.\n\n' +
          'A tooltip is **additive**: it describes, it does not name. An icon-only control still needs its own `aria-label`.\n\n' +
          'It renders no wrapper element — the trigger is supplied by a render prop and the chip is portalled to `document.body`, so it is safe inside a `role="tablist"` (where an intervening `<span>` would fail `aria-required-children`) and inside a scroll container that clips its overflow.',
      },
    },
  },
  argTypes: {
    label: { description: 'The chip’s text. A few words — it names a thing, it never wraps.' },
    disabled: { description: 'Suppresses the chip while still rendering the trigger.' },
    children: {
      description: 'Render prop for the trigger; spread the supplied props onto your element.',
    },
  },
  args: {
    label: 'Groups',
    children: () => null,
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The reference shape: an icon-only button that keeps its own `aria-label`. */
export const Default: Story = {
  render: (args) => (
    <Tooltip {...args}>
      {(trigger) => (
        <button
          type="button"
          aria-label={args.label}
          className="rounded-md p-2.5 text-neutral-600 transition-colors duration-(--dur-instant) hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-primary"
          {...trigger}
        >
          <Icon type="users" size="sm" />
        </button>
      )}
    </Tooltip>
  ),
};

/**
 * The tooltip describes; the `aria-label` names. Both are present, and the a11y
 * addon verifies the trigger is still reachable by its own accessible name — the
 * chip never becomes the only thing naming a control.
 */
export const AccessibleName: Story = {
  args: { label: 'Rules' },
  parameters: {
    a11y: {
      // The point of this story: an icon-only trigger keeps a real accessible name.
      config: { rules: [{ id: 'button-name', enabled: true }] },
    },
  },
  render: Default.render,
};

/**
 * `disabled` keeps the trigger exactly as it is and suppresses only the chip — for a
 * control that is momentarily not worth describing.
 */
export const Disabled: Story = {
  args: { disabled: true },
  render: Default.render,
};

/**
 * Several triggers side by side, which is the case the 400ms hover-intent threshold
 * exists for: sweeping the pointer across a rail of glyphs must not strobe a chip
 * over every one on the way past.
 */
export const InARow: Story = {
  render: () => (
    <div className="flex items-center gap-0.5">
      {(
        [
          ['Users', 'user'],
          ['Groups', 'users'],
          ['Rules', 'bolt'],
          ['Policies', 'shield'],
        ] as const
      ).map(([label, icon]) => (
        <Tooltip key={label} label={label}>
          {(trigger) => (
            <button
              type="button"
              aria-label={label}
              className="rounded-md p-2.5 text-neutral-600 transition-colors duration-(--dur-instant) hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-primary"
              {...trigger}
            >
              <Icon type={icon} size="sm" />
            </button>
          )}
        </Tooltip>
      ))}
    </div>
  ),
};
