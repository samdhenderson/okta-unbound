import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
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
          'Renders `RAIL_TAB_DEFS` from the central `sidepanel/tabs` registry via the shared accessible `Tabs` strip (`rail` variant) and highlights the active one. Selection is reported via `onTabChange`; which tab is active is owned by the caller.\n\n' +
          '**Seven seats, nine sections.** Explorer and History carry `railHidden` and are reached through the ⌘K palette instead (ADR-0063), so they have no glyph here. On either of them no tab matches `activeKey`: the strip shows no selection and no indicator, and the roving anchor falls back to the first tab so the tablist keeps exactly one tab stop — see the `RailHiddenSectionActive` story.\n\n' +
          "Even seven text tabs need well past 450px of strip, but the panel opens at 480px and the user can drag it to 360px — so inactive tabs are icon-only and the active tab's label unfurls beside its glyph, with a tooltip naming any icon on hover or focus. What does not fit still scrolls, with edge fades marking the hidden side, the active tab scrolled into view, and a 2px underline sliding beneath. Compare the `Compact`, `Default` and `Wide` stories: the strip is complete at every width.\n\nThis `nav` is also the bottom of the top-chrome slab: `ContextBar` above it and a rung's `PageHeader` below are borderless, and the single rule closing the chrome lives here.",
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
    activeTab: 'home',
    onTabChange: fn(),
  },
} satisfies Meta<typeof TabNavigation>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Home tab active. */
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
 * Standing on a section the rail has no seat for (ADR-0063).
 *
 * Nothing is selected and no indicator is drawn — the honest rendering — but the
 * tablist keeps exactly one tab stop, so a keyboard user can still Tab into the
 * nav and arrow out of here.
 */
export const RailHiddenSectionActive: Story = {
  args: { activeTab: 'history' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getAllByRole('tab');

    // Named, not counted: History and Explorer are the two that lose a glyph.
    await expect(canvas.queryByRole('tab', { name: 'History' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('tab', { name: 'Explorer' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('tab', { name: 'Home' })).toBeVisible();

    for (const tab of tabs) {
      await expect(tab).toHaveAttribute('aria-selected', 'false');
    }
    // The property that keeps the rail reachable at all from here.
    await expect(tabs.filter((tab) => tab.getAttribute('tabindex') === '0')).toHaveLength(1);
  },
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
