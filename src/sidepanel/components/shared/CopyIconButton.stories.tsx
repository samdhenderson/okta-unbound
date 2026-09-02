import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import CopyIconButton from './CopyIconButton';

/**
 * The ghost copy-to-clipboard control shared by `CopyableId` and `EntityLink`.
 */
const meta = {
  title: 'Shared/CopyIconButton',
  component: CopyIconButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A ghost `IconButton` whose glyph and accessible name flip to a confirmation for ~1.5s after a click. Extracted (D-015) after `EntityLink`’s `copyId` control re-implemented the recipe byte-for-byte alongside `CopyableId`; both now delegate here, so the confirmation timing and the glyph swap are decided once.\n\n' +
          'It carries no visible text: the accessible name is the whole label, which is why callers pass one that names *what* is being copied rather than the bare verb.\n\n' +
          '**Related internals:** [Components](?path=/docs/internals-components--docs)',
      },
    },
  },
  argTypes: {
    value: { description: 'The raw value written to the clipboard on click.' },
    label: { description: 'Resting accessible name, e.g. “Copy group id”.' },
    className: { description: 'Extra classes merged onto the button. Defaults to `shrink-0`.' },
  },
  args: {
    value: '00gFAKE1a2b3c4d5e6',
    label: 'Copy group id',
  },
} satisfies Meta<typeof CopyIconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Resting state: the clipboard glyph, named by its label. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Copy group id' })).toBeInTheDocument();
  },
};

/**
 * The label names the entity, not just the verb — several copy controls can
 * share a screen, and "Copy" alone would make them indistinguishable.
 */
export const NamesWhatItCopies: Story = {
  args: { value: '00uFAKE9z8y7x6w5v4', label: 'Copy user id for ana@example.com' },
};
