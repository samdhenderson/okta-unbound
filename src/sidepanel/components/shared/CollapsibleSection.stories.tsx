import type { Meta, StoryObj } from '@storybook/react-vite';
import CollapsibleSection from './CollapsibleSection';

/** Bordered card whose header toggles the body open/closed. */
const meta = {
  title: 'Shared/CollapsibleSection',
  component: CollapsibleSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Bordered card whose clickable header toggles its body open or closed.\n\n' +
          'Manages its own open/closed state internally (uncontrolled), seeded by `defaultOpen`. A chevron rotates on toggle and an optional count badge shows next to the title (rendered even when the count is zero). The header button carries `aria-expanded`/`aria-controls` for the body region.\n\n' +
          "The body height animates via the shared `.disclose` grid wrapper (`grid-template-rows: 0fr → 1fr`, no JS measurement), so children **stay mounted while collapsed** — held out of the tab order and the accessible tree with `inert`. Don't rely on collapsing to reset or unmount body state. See the **Motion Showcase** story.",
      },
    },
  },
  argTypes: {
    title: { description: 'Header label.' },
    defaultOpen: { description: 'Whether the section starts expanded. Defaults to `true`.' },
    children: {
      description: 'Body content. Stays mounted (and `inert`) while the section is collapsed.',
    },
    itemCount: { description: 'Optional count rendered as a small badge next to the title.' },
  },
  args: {
    title: 'Advanced Filters',
    defaultOpen: true,
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p className="text-sm text-neutral-600">Filter controls would go here</p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" />
          <span>Option A</span>
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" />
          <span>Option B</span>
        </label>
      </div>
    ),
  },
} satisfies Meta<typeof CollapsibleSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default (open). */
export const Default: Story = {};

/** Starts in closed state. */
export const Closed: Story = {
  args: {
    defaultOpen: false,
  },
};

/** With item count badge. */
export const WithItemCount: Story = {
  args: {
    itemCount: 3,
  },
};

/** Zero count badge. */
export const WithZeroCount: Story = {
  args: {
    itemCount: 0,
  },
};

/**
 * Motion showcase — click the header to watch the body's height animate open and
 * closed (`grid-template-rows: 0fr → 1fr`) and the chevron rotate. Every other
 * story runs with motion suppressed, so this is the one place the disclosure is
 * visible; it deliberately has no `play` function, which would race the animation.
 */
export const MotionShowcase: Story = {
  parameters: { motion: 'on' },
  args: {
    title: 'Advanced Filters',
    defaultOpen: false,
    itemCount: 2,
  },
};

/** With longer content. */
export const WithLongContent: Story = {
  args: {
    title: 'Permissions',
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {['View users', 'Edit users', 'Delete users', 'Manage groups', 'View reports'].map(
          (perm) => (
            <label key={perm} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" />
              <span>{perm}</span>
            </label>
          ),
        )}
      </div>
    ),
  },
};
