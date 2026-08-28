import type { Meta, StoryObj } from '@storybook/react-vite';
import FigureNumber from './FigureNumber';

const meta = {
  title: 'Home/FigureNumber',
  component: FigureNumber,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The leading number shared by Home’s findings and its reports. Extracted rather than ' +
          'duplicated: the two cards sit one above the other on the same tab, so a difference in ' +
          'how they set a number would read as a mistake.\n\n' +
          'At least `2.6ch` of `tabular-nums`, so the left edge of the sentences beside it never ' +
          'twitches between a `4` and a `214` — and so an em dash occupies the space a number ' +
          'would, which is what lets a missing value sit in a list without the row looking broken. ' +
          'A minimum rather than a fixed width: a four-digit org widens the column instead of ' +
          'spilling out of it.',
      },
    },
  },
  argTypes: {
    value: { description: 'The count, or null when nothing behind it can support one.' },
  },
  args: { value: 31 },
} satisfies Meta<typeof FigureNumber>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The ordinary case. */
export const Count: Story = {};

/** A real zero is an answer, and looks like one. */
export const Zero: Story = { args: { value: 0 } };

/** Four digits widen the column rather than overflowing it. */
export const Wide: Story = { args: { value: 4821 } };

/**
 * No number to state. Dimmed to normal weight so it does not compete with the
 * rows carrying one, and hidden from assistive technology — the sentence beside
 * it already says what is missing, and "—" is not a fact worth announcing.
 */
export const Unavailable: Story = { args: { value: null } };
