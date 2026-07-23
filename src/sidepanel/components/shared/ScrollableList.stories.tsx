import type { Meta, StoryObj } from '@storybook/react-vite';
import ScrollableList from './ScrollableList';

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
          'Renders a `LoadingSpinner` while `loading`, the `emptyState` node when it has no children, otherwise a scroll region (its own scrollbar) that by default flex-grows to fill available space so surrounding chrome stays visible.',
      },
    },
  },
  argTypes: {
    children: { description: 'The list items to render.' },
    className: { description: 'Additional CSS classes for the container.' },
    emptyState: { description: 'Content to show when there are no children.' },
    loading: { description: 'Shows a loading spinner when true.' },
    loadingMessage: { description: 'Custom message for the loading state.' },
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
