import type { Meta, StoryObj } from '@storybook/react-vite';
import ComparisonHero from './ComparisonHero';
import { mockUsers } from '../../../../test/mocks/fixtures';

const contextUser = mockUsers[0];
const comparedUser = mockUsers[1];

/** Compact header naming both users, with their overall Jaccard match as an overlap bar. */
const meta = {
  title: 'Users/Comparison/ComparisonHero',
  component: ComparisonHero,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Compact header naming both users, with their overall Jaccard match % as a standard overlap bar.\n\n' +
          'Each side renders a per-user gradient avatar (hue derived from the user id), its label, and the display name (the email rides on the `title`, since at side-panel width a second line truncated to nothing). Below them the whole-percent similarity is labelled and drawn as a full-width `rounded-full` bar, tone-coded by overlap — the same bar idiom the Overview tab and the members spread bar use, and one with no minimum width to overflow the panel. While `isLoading`, placeholder glyphs replace the percentage and the bar renders empty. Presentational leaf of the comparison surface.',
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
      description:
        'Overall similarity as a whole percent (0–100), shown as the label and the bar fill.',
    },
    scopeNote: {
      description:
        'What the percentage covers, when that is less than everything — e.g. "groups only" while the app half could not be read. Appended to the `Match` label.',
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

/** High overlap (≥75%) renders the percentage and bar in success color. */
export const HighMatch: Story = {
  args: { similarity: 92 },
};

/** Low overlap renders the percentage and bar in neutral color. */
export const LowMatch: Story = {
  args: { similarity: 8 },
};

/**
 * A partial comparison. The app assignments could not be read, so the percentage
 * is the group figure alone and the label says so — the alternative, averaging in
 * an app score of zero, silently halves the headline.
 */
export const ScopedToGroups: Story = {
  args: { similarity: 25, scopeNote: 'groups only' },
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
