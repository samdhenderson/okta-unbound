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
          'A single, consistent affordance used by the context banner, group overview, and user profile card. Compact (`sm`) or standard (`md`) sizing. Renders nothing when the org origin or any part of the target is missing, so callers can drop it in unconditionally. The URL is built from the validated `oktaOrigin` plus the target and opened with `rel="noopener noreferrer"`.',
      },
    },
  },
  argTypes: {
    oktaOrigin: {
      description: 'Okta org origin used to build the admin URL; the link hides when absent.',
    },
    target: {
      description:
        'What to deep-link to. An app target also carries the app *type* key (`name`), because its Admin Console route is `/admin/app/{name}/instance/{id}`.',
    },
    label: { description: 'Link text. Defaults to `Open in Okta`.' },
    size: { description: 'Compact (`sm`) or standard (`md`) sizing. Defaults to `sm`.' },
    className: { description: 'Extra classes merged onto the anchor.' },
  },
  args: {
    oktaOrigin: 'https://example.okta.com',
    target: { type: 'group', id: '00g1abcdEXAMPLE' },
  },
} satisfies Meta<typeof OpenInOktaLink>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default compact link to a group. */
export const Default: Story = {};

/** Link to a user entity. */
export const User: Story = {
  args: { target: { type: 'user', id: '00u1abcdEXAMPLE' } },
};

/**
 * Link to an app. The route is keyed on the app *type* (`salesforce`) as well as
 * the instance id — an id-only app URL is an error page.
 */
export const App: Story = {
  args: { target: { type: 'app', id: '0oa1abcdEXAMPLE', name: 'salesforce' } },
};

/**
 * An app whose org reported no type key. The link is withheld rather than built
 * from the id twice, so this story renders nothing.
 */
export const AppWithoutTypeKey: Story = {
  args: { target: { type: 'app', id: '0oa1abcdEXAMPLE', name: undefined } },
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
