import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
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
          '**The ⌘K button closes that gap.** The chord alone left two shipped sections unreachable by anyone who did not already know it existed, so the trailing button opens the same palette (`useCommandPalette().open`). It sits beside the tablist, not inside it — it is not a ninth section. Its glyph follows the platform: `⌘K` on Apple, `Ctrl K` everywhere else (`ApplePlatform` / `NonApplePlatform`), and its accessible name spells the modifier out because `⌘` has no reliable pronunciation.\n\n' +
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
    onOpenCommandPalette: {
      description: 'Opens the ⌘K palette. Wire to `useCommandPalette().open` in the shell.',
    },
    shortcutPlatform: {
      description:
        'Which chord glyph to print. Defaults to the running platform, detected from the user agent.',
    },
  },
  args: {
    activeTab: 'home',
    onTabChange: fn(),
    onOpenCommandPalette: fn(),
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
 * On a Mac the chord is drawn as `⌘K`.
 *
 * The symbol is hidden from assistive tech: the button names itself "Search and
 * jump to a section, Command K", because `⌘` read aloud is a place-of-interest
 * sign, not a modifier.
 */
export const ApplePlatform: Story = {
  args: { shortcutPlatform: 'apple' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('button', { name: 'Search and jump to a section, Command K' }),
    ).toBeVisible();
    await expect(canvas.getByText('⌘K')).toBeVisible();
  },
};

/**
 * Everywhere else the same control prints `Ctrl K` — the chord
 * `useCommandPalette` actually listens for off a Mac. Here the visible text and
 * the accessible name agree, so a voice-control user can say what they see.
 */
export const NonApplePlatform: Story = {
  args: { shortcutPlatform: 'other', activeTab: 'explorer' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('button', { name: 'Search and jump to a section, Ctrl K' }),
    ).toBeVisible();
  },
};

/**
 * The affordance survives the narrowest panel. The rail gives way and scrolls;
 * the ⌘K button does not shrink, because a control that disappears at 360px is
 * exactly the failure it exists to fix.
 */
export const CompactWithShortcut: Story = {
  args: { activeTab: 'policies', shortcutPlatform: 'other' },
  globals: { viewport: { value: 'sidepanelCompact' } },
  render: atPanelWidth(360),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: /Search and jump to a section/ }));
    await expect(args.onOpenCommandPalette).toHaveBeenCalled();
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
