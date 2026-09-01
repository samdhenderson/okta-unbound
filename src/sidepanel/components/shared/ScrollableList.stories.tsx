import type { Meta, StoryObj } from '@storybook/react-vite';
import ScrollableList from './ScrollableList';
import Skeleton from './Skeleton';

/**
 * Independently scrollable list container with loading and empty states.
 */
const meta = {
  title: 'Shared/ScrollableList',
  component: ScrollableList,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Independently scrollable list container with built-in loading and empty states.\n\n' +
          'Renders a `LoadingSpinner` while `loading`, the `emptyState` node when it has no children, otherwise a scroll region (its own scrollbar) that by default flex-grows to fill available space so surrounding chrome stays visible. A caller whose loading state has a known shape can pass a `Skeleton` via `skeleton` instead of the default spinner.',
      },
    },
  },
  argTypes: {
    children: { description: 'The list items to render.' },
    className: { description: 'Additional CSS classes for the container.' },
    emptyState: { description: 'Content to show when there are no children.' },
    loading: { description: 'Shows a loading spinner when true.' },
    loadingMessage: { description: 'Custom message for the loading state.' },
    skeleton: {
      description:
        'Optional known-shape placeholder (typically a `Skeleton`) shown instead of the default spinner while `loading` is true.',
    },
    maxHeight: { description: 'Optional explicit max-height (e.g. "400px", "50vh").' },
    fillAvailable: { description: 'If true (default), uses flex-grow to fill remaining space.' },
    testId: { description: 'Test id applied to the container.' },
  },
  args: {
    children: null,
  },
} satisfies Meta<typeof ScrollableList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default with list items. */
export const Default: Story = {
  args: {
    children: (
      <>
        <div className="p-3 bg-white border border-neutral-200 rounded-md">Item 1</div>
        <div className="p-3 bg-white border border-neutral-200 rounded-md">Item 2</div>
        <div className="p-3 bg-white border border-neutral-200 rounded-md">Item 3</div>
      </>
    ),
  },
};

/** Loading state with spinner. */
export const Loading: Story = {
  args: {
    loading: true,
    children: null,
  },
};

/** Loading with custom message. */
export const LoadingWithMessage: Story = {
  args: {
    loading: true,
    loadingMessage: 'Fetching groups...',
    children: null,
  },
};

/** Loading with a `Skeleton` shown instead of the default spinner. */
export const LoadingWithSkeleton: Story = {
  args: {
    loading: true,
    skeleton: <Skeleton variant="row" count={4} label="Loading groups" />,
    children: null,
  },
};

/** Empty state. */
export const Empty: Story = {
  args: {
    children: null,
    emptyState: (
      <div className="py-8 text-center text-neutral-500">
        <p className="text-sm">No items found</p>
      </div>
    ),
  },
};

/** With explicit max height. */
export const WithMaxHeight: Story = {
  args: {
    maxHeight: '300px',
    fillAvailable: false,
    children: (
      <>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="p-3 bg-white border border-neutral-200 rounded-md">
            Item {i + 1}
          </div>
        ))}
      </>
    ),
  },
};

/**
 * The loading placeholder occupies the same box as the loaded list.
 *
 * Both stories below pass the identical `className="mt-4"` and
 * `maxHeight="300px"`; the only difference is `loading`. The top edge of the
 * first row must not move between them. Before box parity the loading branch
 * dropped both props, so a real skeleton rendered 16px high and unclipped —
 * which is what put `AppsListPanel`'s placeholder flush against its toolbar.
 * ADR-0023 bans asserting a class string, so this pair *is* the coverage.
 */
export const BoxParityLoading: Story = {
  args: {
    loading: true,
    className: 'mt-4',
    maxHeight: '300px',
    fillAvailable: false,
    skeleton: <Skeleton variant="row" count={4} label="Loading groups" />,
    children: null,
  },
};

/**
 * The same pair with a scrollbar in play — the half `D-053g` left behind.
 *
 * The reserved channel (`scrollbar-gutter: stable`) lived only on the scrolling
 * branch, so the loaded box gave up 6px of content width that the loading box did
 * not, and the rows shifted sideways the moment the spinner was replaced. Flip
 * between this story and the one below: the left edge of the content must not
 * move (`D-054`). Per ADR-0023 the pair *is* the coverage — the class string
 * itself is not asserted.
 */
export const GutterParityLoading: Story = {
  args: {
    loading: true,
    maxHeight: '160px',
    fillAvailable: false,
    skeleton: <Skeleton variant="row" count={3} label="Loading groups" />,
    children: null,
  },
};

/** The loaded counterpart of {@link GutterParityLoading} — enough rows to scroll. */
export const GutterParityLoaded: Story = {
  args: {
    maxHeight: '160px',
    fillAvailable: false,
    children: (
      <>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="p-3 bg-white border border-neutral-200 rounded-md">
            Item {i + 1}
          </div>
        ))}
      </>
    ),
  },
};

/** The loaded counterpart of {@link BoxParityLoading} — same box, real rows. */
export const BoxParityLoaded: Story = {
  args: {
    className: 'mt-4',
    maxHeight: '300px',
    fillAvailable: false,
    children: (
      <>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="p-3 bg-white border border-neutral-200 rounded-md">
            Item {i + 1}
          </div>
        ))}
      </>
    ),
  },
};

/** Multiple items filling available space. */
export const FillAvailable: Story = {
  args: {
    fillAvailable: true,
    children: (
      <>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="p-3 bg-white border border-neutral-200 rounded-md">
            Item {i + 1}
          </div>
        ))}
      </>
    ),
  },
};
