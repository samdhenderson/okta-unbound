import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import TabNavigation from './TabNavigation';

/** Sticky top tab bar for switching between the side panel's main views. */
const meta = {
  title: 'Sidepanel/TabNavigation',
  component: TabNavigation,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "Sticky top tab bar for switching between the side panel's main views.\n\n" +
          'Renders the Overview / Users / Groups / Rules / Export / History tabs and highlights the active one with an underline. Selection is reported via `onTabChange`; which tab is active is owned by the caller.',
      },
    },
  },
  argTypes: {
    activeTab: {
      description: 'Currently selected tab, rendered with the active styling and underline.',
    },
    onTabChange: { description: 'Called with the chosen tab id when a tab is clicked.' },
  },
  args: {
    activeTab: 'overview',
    onTabChange: fn(),
  },
} satisfies Meta<typeof TabNavigation>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Overview tab active. */
export const Default: Story = {};

/** Users tab active. */
export const UsersActive: Story = {
  args: { activeTab: 'users' },
};

/** Groups tab active. */
export const GroupsActive: Story = {
  args: { activeTab: 'groups' },
};

/** Rules tab active. */
export const RulesActive: Story = {
  args: { activeTab: 'rules' },
};

/** History tab active — the last tab in the row. */
export const HistoryActive: Story = {
  args: { activeTab: 'history' },
};
