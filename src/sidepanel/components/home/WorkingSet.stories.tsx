import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import WorkingSet from './WorkingSet';
import type { WorkingSetRef } from '../../../shared/storage/workingSetStore';

const DAY = 24 * 60 * 60 * 1000;

const PINS: WorkingSetRef[] = [
  {
    kind: 'group',
    id: '00gFAKE0000000000001',
    name: 'Engineering',
    lastPane: 'Members',
    lastSeenAt: Date.now(),
  },
  {
    kind: 'user',
    id: '00uFAKE0000000000001',
    name: 'Ada Lovelace',
    lastPane: 'Profile',
    lastSeenAt: Date.now() - 2 * DAY,
  },
];

const RECENTS: WorkingSetRef[] = [
  {
    kind: 'group',
    id: '00gFAKE0000000000002',
    name: 'Contractors',
    lastSeenAt: Date.now() - DAY,
  },
  {
    kind: 'user',
    id: '00uFAKE0000000000002',
    name: 'Grace Hopper',
    lastPane: 'Groups',
    lastSeenAt: Date.now() - 4 * DAY,
  },
];

const meta = {
  title: 'Home/WorkingSet',
  component: WorkingSet,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    // heading-order disabled: the section headings render as `h3` out of the
    // app shell, with no `h1` above them.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          'The Home tab’s second region: what you pinned, and what you were just looking at.\n\n' +
          '**The empty state is the point, not a fallback.** The obvious move for a cold panel is ' +
          'to render nothing — but the pin lives in the corner of a detail header, which is a place ' +
          'nobody looks until they know something is there. So an empty *Pinned* list holds its ' +
          'space and says how to fill it. It is the only surface that can teach the affordance, and ' +
          'it can only do that by existing before it has content.\n\n' +
          '*Recent* is the opposite: it fills itself the first time you open anything, needs no ' +
          'instructions, and is simply absent until it has rows.',
      },
    },
  },
  argTypes: {
    pinned: { description: 'Entities the reader chose to keep.' },
    recent: { description: 'Entities recently opened, most recent first.' },
    onOpen: { description: 'Open one on its owning tab.' },
    onUnpin: { description: 'Release a pin.' },
    onForget: { description: 'Drop a recent.' },
  },
  args: { pinned: PINS, recent: RECENTS, onOpen: fn(), onUnpin: fn(), onForget: fn() },
} satisfies Meta<typeof WorkingSet>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Both lists populated. */
export const Default: Story = {};

/**
 * A cold panel. Pinned holds its space and teaches the affordance; Recent is
 * absent entirely, because it needs no teaching.
 */
export const ColdStart: Story = {
  args: { pinned: [], recent: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Nothing pinned yet/)).toBeInTheDocument();
    // The absence is the assertion — one of the few things a story genuinely
    // proves, since the headless runner loads no Tailwind and cannot judge
    // layout.
    await expect(canvas.queryByText('Recent')).not.toBeInTheDocument();
  },
};

/** Nothing pinned, but the reader has been browsing. */
export const RecentsOnly: Story = {
  args: { pinned: [] },
};

/** Pins with nothing recent — every recent aged out of the 14-day window. */
export const PinsOnly: Story = {
  args: { recent: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText('Recent')).not.toBeInTheDocument();
  },
};
