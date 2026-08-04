import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import TabNavigation from './TabNavigation';

/** Sticky top icon rail for switching between the side panel's main views. */
const meta = {
  title: 'Sidepanel/TabNavigation',
  component: TabNavigation,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "Sticky top icon rail for switching between the side panel's main views.\n\n" +
          'Renders the tabs from the central `sidepanel/tabs` registry via the shared accessible `Tabs` strip (`rail` variant) and highlights the active one. Selection is reported via `onTabChange`; which tab is active is owned by the caller.\n\n' +
          "Eight text tabs need roughly 590px of strip, but the panel opens at 480px and the user can drag it to 360px — so inactive tabs are icon-only and the active tab's label unfurls beside its glyph. What does not fit still scrolls, with edge fades marking the hidden side, the active tab scrolled into view, and an indicator sliding underneath. Compare the `Compact`, `Default` and `Wide` stories: the strip is complete at every width.",
      },
    },
  },
  argTypes: {
    activeTab: {
      description:
        'Currently selected tab, rendered with its label unfurled and the indicator beneath.',
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

/** History tab active — the last tab in the row, previously reachable only by scrolling. */
export const HistoryActive: Story = {
  args: { activeTab: 'history' },
};

/**
 * Renders the rail inside a hard-bounded panel width. The `viewport` global sizes
 * the explorer's canvas, but the headless story runner and the autodocs preview
 * block use their own size — so the width that the overflow behavior depends on is
 * pinned here as well, and the story proves the same thing everywhere it renders.
 */
const atPanelWidth = (width: number): Story['render'] =>
  function PanelFrame(args) {
    return (
      <div style={{ width }} className="border border-neutral-200">
        <TabNavigation {...args} />
      </div>
    );
  };

/**
 * 360px — the narrowest the side panel is realistically dragged, and the proof
 * the overflow is gone: every section is still a visible, hittable target.
 */
export const Compact: Story = {
  args: { activeTab: 'policies' },
  globals: { viewport: { value: 'sidepanelCompact' } },
  render: atPanelWidth(360),
};

/** 480px — the width the side panel opens at. */
export const DefaultWidth: Story = {
  args: { activeTab: 'export' },
  globals: { viewport: { value: 'sidepanelDefault' } },
  render: atPanelWidth(480),
};

/** 720px — a dragged-out panel, where the whole rail fits with room to spare. */
export const Wide: Story = {
  args: { activeTab: 'apps' },
  globals: { viewport: { value: 'sidepanelWide' } },
  render: atPanelWidth(720),
};

/**
 * Motion enabled, so the label unfurl and the indicator slide run at their real
 * `--dur-move` duration. No `play` function — an interaction would race it.
 */
export const MotionShowcase: Story = {
  args: { activeTab: 'groups' },
  parameters: { motion: 'on' },
  globals: { viewport: { value: 'sidepanelCompact' } },
  render: atPanelWidth(360),
};
