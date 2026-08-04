import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import TabPanel from './TabPanel';
import { Button } from './shared';

/**
 * One top-level tab's panel: visibility, its own Suspense boundary, and its own
 * slice of the shared root scroller's offset.
 */
const meta = {
  title: 'Sidepanel/TabPanel',
  component: TabPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Wraps one top-level tab. Tabs mount on first activation and are hidden — never unmounted — thereafter (ADR-0018), so React state survives but DOM scroll state does not.\n\n' +
          'Every root-scrolling tab shares a single scroll container (the `overflow-y-auto` root in `App`). Each panel runs its own `useScrollPreservation` against it, so returning to a tab restores *that tab’s* offset rather than whatever the tab you visited in between left behind. The panel also owns a private `Suspense` boundary, so a lazily-loaded tab cannot swap a fallback in over its already-mounted neighbours.',
      },
    },
  },
  argTypes: {
    isActive: { description: 'Whether this is the selected tab. Drives visibility and scroll.' },
    scrollRef: { description: 'Ref on the shared scrolling element. Inert when unset.' },
    children: { description: "The tab's content. Mounted once, then kept mounted." },
  },
} satisfies Meta<typeof TabPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Filler tall enough to make the shared container actually scroll. */
const TallContent = ({ label }: { label: string }) => (
  <div className="max-w-7xl mx-auto px-6 py-6 space-y-3">
    {Array.from({ length: 30 }, (_, i) => (
      <div key={i} className="p-3 bg-white border border-neutral-200 rounded-md text-sm">
        {label} — row {i + 1}
      </div>
    ))}
  </div>
);

/** The active panel: visible, and mirroring the container's scroll offset. */
export const Active: Story = {
  args: {
    isActive: true,
    scrollRef: { current: null },
    children: <TallContent label="Active panel" />,
  },
};

/**
 * A hidden panel stays mounted but leaves the accessibility tree and the tab order
 * (renders nothing — the panel is `display: none`).
 */
export const Hidden: Story = {
  args: {
    isActive: false,
    scrollRef: { current: null },
    children: <TallContent label="Hidden panel" />,
  },
};

/**
 * Two panels sharing one scroll container, as `App` arranges them. Scroll one panel,
 * switch, scroll the other, then switch back — each returns to its own offset.
 */
export const SharedScrollContainer: Story = {
  args: {
    isActive: true,
    scrollRef: { current: null },
    children: null,
  },
  render: function SharedScrollContainerStory() {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState<'one' | 'two'>('one');

    return (
      <div ref={scrollRef} className="h-screen overflow-y-auto bg-canvas">
        <div className="sticky top-0 z-10 flex gap-2 px-6 py-3 bg-canvas border-b border-neutral-200">
          <Button
            variant={active === 'one' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActive('one')}
          >
            Panel one
          </Button>
          <Button
            variant={active === 'two' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActive('two')}
          >
            Panel two
          </Button>
        </div>
        <TabPanel isActive={active === 'one'} scrollRef={scrollRef}>
          <TallContent label="Panel one" />
        </TabPanel>
        <TabPanel isActive={active === 'two'} scrollRef={scrollRef}>
          <TallContent label="Panel two" />
        </TabPanel>
      </div>
    );
  },
};
