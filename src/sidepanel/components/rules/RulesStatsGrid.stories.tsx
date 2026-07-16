import type { Meta, StoryObj } from '@storybook/react-vite';
import RulesStatsGrid from './RulesStatsGrid';

/** The Rules tab's four summary tiles: total / active / inactive / conflicts. */
const meta = {
  title: 'Rules/RulesStatsGrid',
  component: RulesStatsGrid,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    stats: { total: 42, active: 30, inactive: 12, conflicts: 0 },
  },
} satisfies Meta<typeof RulesStatsGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No conflicts — the conflicts tile stays neutral. */
export const Default: Story = {};

/** Conflicts present — the conflicts tile switches to warning styling. */
export const WithConflicts: Story = {
  args: { stats: { total: 42, active: 28, inactive: 10, conflicts: 4 } },
};

/** No rules at all. */
export const Empty: Story = {
  args: { stats: { total: 0, active: 0, inactive: 0, conflicts: 0 } },
};

/** A large rule set, exercising the thousands-separator formatting. */
export const LargeCounts: Story = {
  args: { stats: { total: 12500, active: 11800, inactive: 700, conflicts: 15 } },
};
