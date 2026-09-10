import type { Meta, StoryObj } from '@storybook/react-vite';
import ProfileDisplayDragGhost from './ProfileDisplayDragGhost';

/** The label that follows the pointer while something is being dragged. */
const meta = {
  title: 'Users/ProfileDisplayDragGhost',
  component: ProfileDisplayDragGhost,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A translucent follower carrying the dragged attribute or section name.\n\n' +
          'It is deliberately 68% opaque: the drop indicator underneath it is the control that answers "where will this land", and a solid ghost sitting on that line hides the answer at the moment it matters. `aria-hidden`, because the editor\'s live region already says the same thing in words.',
      },
    },
  },
  argTypes: {
    label: { description: 'What is being dragged — an attribute label or a category name.' },
    x: { description: 'Client X of the pointer.' },
    y: { description: 'Client Y of the pointer.' },
    reducedMotion: { description: 'Drop the follow transition when reduced motion is asked for.' },
  },
  args: { label: 'Department', x: 80, y: 80 },
} satisfies Meta<typeof ProfileDisplayDragGhost>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Following the pointer. */
export const Default: Story = {};

/** A section name rather than an attribute label. */
export const SectionGhost: Story = { args: { label: 'Contact & locale' } };

/** No follow transition, for an admin who has asked for reduced motion. */
export const ReducedMotion: Story = { args: { reducedMotion: true } };
