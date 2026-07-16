import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import CopyMembersModal from './CopyMembersModal';
import { mockUsers } from '../../../../test/mocks/handlers';

/** Modal that copies the current member list as name / email / username, one per line. */
const meta = {
  title: 'Overview/Members/CopyMembersModal',
  component: CopyMembersModal,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    isOpen: true,
    onClose: fn(),
    members: mockUsers.slice(0, 20),
  },
} satisfies Meta<typeof CopyMembersModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default "email" format with a live preview. */
export const Default: Story = {};

/** A large member set truncates the preview with an "…and N more" summary. */
export const LongList: Story = {
  args: { members: mockUsers },
};

/** No members to copy — the preview and copy button both reflect the empty state. */
export const Empty: Story = {
  args: { members: [] },
};

/** Closed state renders nothing. */
export const Closed: Story = {
  args: { isOpen: false },
};
