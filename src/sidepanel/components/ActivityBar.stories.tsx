import type { Meta, StoryObj } from '@storybook/react-vite';
import ActivityBar from './ActivityBar';

/**
 * Container that wires `useActivityBar` (scheduler + progress context state) to
 * the pure `ActivityBarView`. Renders idle here since the global decorator
 * provides empty Scheduler/Progress context with no in-flight activity.
 */
const meta = {
  title: 'Sidepanel/ActivityBar',
  component: ActivityBar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ActivityBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Idle state derived from the default (empty) Scheduler/Progress context. */
export const Default: Story = {};
