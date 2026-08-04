import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import TabJumpPalette from './TabJumpPalette';

/** ⌘K jump-to palette for the panel's eight top-level sections. */
const meta = {
  title: 'Sidepanel/TabJumpPalette',
  component: TabJumpPalette,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "⌘K jump-to palette for the side panel's eight top-level sections.\n\n" +
          'The primary nav is an icon rail, so inactive tabs are icon-only — compact, but it asks the user to aim at a small target. This palette is the keyboard route to the same destinations: it costs no horizontal space and no clicks. Filtering is a case-insensitive substring match on the section label; the section you are already on is marked `aria-current="page"` and labelled **Current**; choosing a result calls the same `onTabChange` the rail calls and then closes.\n\n' +
          'Scope is deliberately navigation destinations only — searching groups, users or rules from here is a later feature, and the result list is shaped as a generic `{ id, label, icon }` row so that lands as extra sections rather than a rewrite.\n\n' +
          '**Keyboard model — roving focus, not a combobox.** The shared `Input` does not spread arbitrary props, and bending a shared primitive with `role`/`aria-expanded`/`aria-controls`/`aria-activedescendant` for one consumer is the wrong trade. So: Down leaves the field for the first result, Up/Down move within the list (Up off the top returns to the field), Enter or Space activates, Escape closes. Exactly one row is in the tab order at a time.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs) — the ⌘K listener itself lives in `useCommandPalette`, called once by `App`, because every tab stays mounted (ADR-0018) and a `window` listener inside a tab would be registered eight times over.',
      },
    },
  },
  argTypes: {
    isOpen: {
      description:
        'When false the palette closes; the underlying `Modal` holds the panel for one exit animation, hidden from the accessible tree.',
    },
    onClose: {
      description:
        'Invoked on Escape, overlay click, the header close button, and after a result is chosen.',
    },
    activeTab: {
      description:
        'The section currently on screen — marked `aria-current="page"` and labelled "Current".',
    },
    onSelect: {
      description:
        'Called with the chosen section id. Must be the same handler the icon rail uses.',
    },
  },
  args: {
    isOpen: true,
    onClose: fn(),
    activeTab: 'overview',
    onSelect: fn(),
  },
} satisfies Meta<typeof TabJumpPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Freshly opened: the unfiltered list of all eight sections. */
export const Default: Story = {};

/** Opened from a different section, so a different row carries the "Current" marker. */
export const ActiveSectionMarked: Story = {
  args: { activeTab: 'policies' },
};

/**
 * A query narrowing the list. "or" appears mid-label in both matches, which is
 * the substring (not prefix) behaviour.
 */
export const Filtered: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByRole('searchbox', { name: 'Search sections' });
    await userEvent.type(field, 'or');
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('2 sections'));
  },
};

/** No section matches — the shared `EmptyState`, not a blank panel. */
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByRole('searchbox', { name: 'Search sections' });
    await userEvent.type(field, 'zzz');
    await canvas.findByText('No sections match');
  },
};

/** Closed — the palette renders nothing at all. */
export const Closed: Story = {
  args: { isOpen: false },
};

/**
 * Motion enabled, so the overlay/panel entrance and the staggered `rise-in` of
 * the result rows run at their real durations. No `play` function — an
 * interaction assertion would race the animation.
 */
export const MotionShowcase: Story = {
  parameters: { motion: 'on' },
  globals: { viewport: { value: 'sidepanelDefault' } },
};
