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
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Shared “Open in Okta” deep link that opens an entity’s Admin Console page in a new tab.\n\n' +
          'A single, consistent affordance used by the context banner, group overview, and user profile card. Compact (`sm`) or standard (`md`) sizing. Renders nothing when the org origin or entity id is missing, so callers can drop it in unconditionally. The URL is built from the validated `oktaOrigin` plus id and opened with `rel="noopener noreferrer"`.',
      },
    },
  },
  argTypes: {
    oktaOrigin: {
      description: 'Okta org origin used to build the admin URL; the link hides when absent.',
    },
    entityType: { description: 'Which kind of entity to deep-link to.' },
    entityId: { description: 'The entity’s Okta id; the link hides when absent.' },
    label: { description: 'Link text. Defaults to `Open in Okta`.' },
    size: { description: 'Compact (`sm`) or standard (`md`) sizing. Defaults to `sm`.' },
    className: { description: 'Extra classes merged onto the anchor.' },
  },
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
