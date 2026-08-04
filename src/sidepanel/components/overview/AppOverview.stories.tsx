import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import AppOverview from './AppOverview';
import { useOktaApi, makeUseOktaApiValue } from '../../../../.storybook/mocks/useOktaApi.mock';

/** A benign app record for the enrichment read. */
const appRecord = (overrides: Record<string, unknown> = {}) => ({
  id: '0oaFAKE001',
  label: 'Salesforce',
  name: 'salesforce',
  status: 'ACTIVE',
  signOnMode: 'SAML_2_0',
  ...overrides,
});

/**
 * Overview branch for a detected Okta app page: identity + status, sign-on mode,
 * assignment stat cards, the app-specific authentication-policy note, and the
 * app-scoped export deep-links. The enrichment reads come from the mocked
 * `useOktaApi` facade; each degrades to an em dash rather than an error state.
 */
const meta = {
  title: 'Overview/AppOverview',
  component: AppOverview,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  argTypes: {
    appId: { description: 'Detected Okta app id.' },
    appName: { description: 'Detected Okta app display name.' },
    targetTabId: {
      description: 'Tab hosting the Okta session; omit to render identity + exports only.',
    },
    onExport: { description: 'Open the Export tab pre-scoped to an app-scoped descriptor.' },
  },
  args: {
    appId: '0oaFAKE001',
    appName: 'Salesforce',
    targetTabId: 1,
    onExport: fn(),
  },
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        getAppById: fn(async () => appRecord()),
        getAppAssignmentCounts: fn(async () => ({ users: 1284, groups: 12 })),
      }),
    );
  },
} satisfies Meta<typeof AppOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Fully enriched app: status, sign-on mode, assignment counts, exports. */
export const Default: Story = {};

/** The app has its own authentication policy — the note appears (no link yet). */
export const WithAppSpecificPolicy: Story = {
  args: { appId: '0oaFAKE002' },
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        // Derived from the app record's own `_links`, not a second request.
        getAppById: fn(async () => ({
          ...appRecord({ id: '0oaFAKE002' }),
          _links: {
            accessPolicy: {
              href: 'https://example.okta.com/api/v1/policies/rstFAKE0123456789abc',
            },
          },
        })),
        getAppAssignmentCounts: fn(async () => ({ users: 42, groups: 3 })),
      }),
    );
  },
};

/** An inactive app with no assignments. */
export const Inactive: Story = {
  args: { appId: '0oaFAKE003' },
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        getAppById: fn(async () => appRecord({ id: '0oaFAKE003', status: 'INACTIVE' })),
        getAppAssignmentCounts: fn(async () => ({ users: 0, groups: 0 })),
      }),
    );
  },
};

/**
 * Enrichment unavailable (a forbidden or failed read): identity and the export
 * deep-links still render, the supplementary values show an em dash.
 */
export const EnrichmentUnavailable: Story = {
  args: { appId: '0oaFAKE004' },
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        getAppById: fn(async () => null),
        getAppAssignmentCounts: fn(async () => null),
      }),
    );
  },
};
