import type { Meta, StoryObj } from '@storybook/react-vite';
import ComparisonHero from './ComparisonHero';
import { mockUsers } from '../../../../test/mocks/handlers';

const contextUser = mockUsers[0];
const comparedUser = mockUsers[1];

/** Split-screen header showing both users' avatars and their overall Jaccard match %. */
const meta = {
  title: 'Users/Comparison/ComparisonHero',
  component: ComparisonHero,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Split-screen header showing both users and their overall Jaccard match %.\n\n' +
          'Each side renders a per-user gradient avatar (hue derived from the user id), label, name, and email/login; the center chip shows the whole-percent similarity, tone-coded by overlap. While `isLoading`, the chip renders placeholder glyphs instead of the computed percentage. Presentational leaf of the comparison modal.',
      },
    },
  },
  args: {
    contextUser,
    comparedUser,
    contextName: 'First1 Last1',
    comparedName: 'First2 Last2',
    similarity: 62,
    isLoading: false,
  },
  argTypes: {
    contextUser: { description: 'The context user (left side).' },
    comparedUser: { description: 'The compared user (right side).' },
    contextName: { description: 'Display name for the context user.' },
    comparedName: { description: 'Display name for the compared user.' },
    similarity: {
      description: 'Overall similarity as a whole percent (0–100), shown in the center chip.',
    },
    isLoading: {
      description: 'When true, renders placeholder glyphs instead of the match percentage.',
    },
  },
} satisfies Meta<typeof ComparisonHero>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default hero with a mid-range match percentage. */
export const Default: Story = {};

/** High overlap (≥75%) renders the match chip in success color. */
export const HighMatch: Story = {
  args: { similarity: 92 },
};

/** Low overlap renders the match chip in neutral color. */
export const LowMatch: Story = {
  args: { similarity: 8 },
};

/** Loading state shows placeholder glyphs instead of the computed percentage. */
export const Loading: Story = {
  args: { isLoading: true },
};

/** Long display names truncate within each side without breaking layout. */
export const LongNames: Story = {
  args: {
    contextName: 'Alexandria Fitzgerald-Montgomery-Whitcombe',
    comparedName: 'Bartholomew Christopherson-Van Der Berg',
  },
};
