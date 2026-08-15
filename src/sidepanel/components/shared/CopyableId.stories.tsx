import type { Meta, StoryObj } from '@storybook/react-vite';
import CopyableId from './CopyableId';

/**
 * An Okta identifier shown inline, with a one-click copy.
 */
const meta = {
  title: 'Shared/CopyableId',
  component: CopyableId,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A truncating `<code>` beside a ghost `IconButton` whose glyph and accessible name flip to a confirmation for ~1.5s. The single home for a recipe that was hand-rolled identically in `ContextBar` and the user identity card, both of which also pinned the glyph and the text to arbitrary sizes the design system already answers.\n\n' +
          'Distinct from `CopyButton`, which is a labelled `Button` for copying a *body* of text (a list of emails, a CSV). This is for a single identifier in a line of metadata, where a full button would outweigh the value beside it.\n\n' +
          '**Related internals:** [Components](?path=/docs/internals-components--docs)',
      },
    },
  },
  argTypes: {
    value: { description: 'The identifier to render and copy.' },
    label: { description: 'Accessible name for the copy control, e.g. “Copy group id”.' },
    className: { description: 'Extra classes merged onto the wrapper.' },
  },
  args: {
    value: '00gFAKE1a2b3c4d5e6',
    label: 'Copy group id',
  },
} satisfies Meta<typeof CopyableId>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A group id. */
export const Default: Story = {};

/** A user id — the label names what is being copied, since several can share a screen. */
export const UserId: Story = {
  args: { value: '00uFAKE9z8y7x6w5v', label: 'Copy user id' },
};

/** A long identifier truncates rather than widening its container. */
export const Truncated: Story = {
  args: { value: '00gFAKE1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9' },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
