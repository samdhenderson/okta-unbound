import type { Meta, StoryObj } from '@storybook/react-vite';
import RackLegend from './RackLegend';

/**
 * The key to the bucket rack's lanes.
 *
 * It exists because the lanes and the legend do different jobs. A lane's label
 * line names the state of *that* lane and is what makes the rack readable with
 * the patterns ignored entirely; the legend names the **vocabulary**, once, so a
 * reader can learn the track's grammar and then read six lanes by shape at a
 * glance instead of six label lines in sequence.
 */
const meta = {
  title: 'Sidepanel/Activity/RackLegend',
  component: RackLegend,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The bucket rack’s key.\n\n' +
          'Comparing families is the whole reason the rack exists (ADR-0059), and a legend is what makes that comparison happen in one look rather than six. It also carries the one thing no single lane can say: that a **pale tail is headroom, not absence** — a track drawn against remaining budget has a meaningful empty part, and nothing in a lane’s own words explains that.\n\n' +
          'Every swatch is `aria-hidden` and the text beside it carries the meaning, so the legend costs a screen-reader user nothing and tells them nothing they are missing — every magnitude it keys is already on each lane’s accessible name. Decoration in the accessibility tree, information in the visual one, which is the correct split for a key.\n\n' +
          'It **wraps** rather than scrolls: on a narrow panel it becomes two short rows, which costs a few pixels once, where a horizontal scroller would hide half the vocabulary behind a gesture nobody knows to make.',
      },
    },
  },
} satisfies Meta<typeof RackLegend>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The full vocabulary, as it renders beneath the rack. */
export const Default: Story = {};

/**
 * At side-panel width, where the legend wraps to two rows. This is the real
 * case — a Chrome side panel is about 400px, and the expanded bar is where the
 * rack lives.
 */
export const NarrowPanel: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  decorators: [
    (Story) => (
      <div style={{ width: 360, border: '1px solid var(--color-neutral-200)' }}>
        <Story />
      </div>
    ),
  ],
};
