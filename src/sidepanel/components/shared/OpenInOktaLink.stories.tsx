import type { Meta, StoryObj } from '@storybook/react-vite';
import OpenInOktaLink from './OpenInOktaLink';

/**
 * Shared "Open in Okta" deep link into the Admin Console. Used consistently by the
 * user profile card and group overview so every context exposes an identical
 * affordance. Renders nothing when the org origin or entity id is missing.
 */
const meta = {
  title: 'Shared/OpenInOktaLink',
  component: OpenInOktaLink,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    oktaOrigin: 'https://example.okta.com',
    entityType: 'group',
    entityId: '00g1abcdEXAMPLE',
  },
} satisfies Meta<typeof OpenInOktaLink>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default compact link to a group. */
export const Default: Story = {};

/** Link to a user entity. */
export const User: Story = {
  args: { entityType: 'user', entityId: '00u1abcdEXAMPLE' },
};

/** Standard (md) size. */
export const Medium: Story = {
  args: { size: 'md' },
};

/** Custom label. */
export const CustomLabel: Story = {
  args: { label: 'Open in Admin Console', size: 'md' },
};

/** Hidden entirely when the org origin is unknown (renders nothing). */
export const NoOrigin: Story = {
  args: { oktaOrigin: null },
};
