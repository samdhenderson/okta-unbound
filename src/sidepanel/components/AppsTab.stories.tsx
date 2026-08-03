import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import AppsTab from './AppsTab';
import { useOktaApi, makeUseOktaApiValue } from '../../../.storybook/mocks/useOktaApi.mock';
import type { OktaAppListItem } from '../../shared/schemas/okta';

/** A small, obviously-fake app inventory spanning the status/sign-on-mode axes. */
const sampleApps = [
  {
    id: '0oaFAKE0001',
    name: 'salesforce',
    label: 'Salesforce',
    status: 'ACTIVE',
    signOnMode: 'SAML_2_0',
    created: '2026-01-15T09:00:00.000Z',
    lastUpdated: '2026-06-02T11:30:00.000Z',
  },
  {
    id: '0oaFAKE0002',
    name: 'workday',
    label: 'Workday HR',
    status: 'INACTIVE',
    signOnMode: 'SAML_2_0',
    created: '2026-03-01T09:00:00.000Z',
  },
  {
    id: '0oaFAKE0003',
    name: 'bookmark',
    label: 'Internal Wiki',
    status: 'ACTIVE',
    signOnMode: 'BOOKMARK',
    created: '2025-11-20T09:00:00.000Z',
  },
  {
    id: '0oaFAKE0004',
    name: 'okta_org2org',
    status: 'ACTIVE',
    signOnMode: 'SAML_2_0',
  },
] as OktaAppListItem[];

/**
 * Applications tab shell: a READ-ONLY inventory of the org's Okta applications,
 * loaded once on mount and filtered/sorted client-side.
 */
const meta = {
  title: 'Apps/AppsTab',
  component: AppsTab,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    // heading-order disabled: this story renders the tab as a page fragment out of
    // its heading context (no surrounding app shell), so axe flags the isolated headings.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          "Applications tab shell: browse, search, filter, and sort the org's application inventory.\n\n" +
          'Read-only by construction — the tab reaches only for `getAllApps` and (lazily, per ' +
          'expanded row) `getAppAssignmentCounts`. A failed inventory load surfaces as a ' +
          'dismissible `danger` banner rather than an empty list presented as complete.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Storage & cache](?path=/docs/internals-storage-cache--docs), ' +
          '[Scheduler & messaging](?path=/docs/internals-scheduler-messaging--docs)',
      },
    },
  },
  argTypes: {
    targetTabId: {
      description:
        'Chrome tab id of the connected Okta tab; the inventory load is skipped when null.',
    },
    oktaOrigin: {
      description: 'Okta org origin used to build each row\'s "Open in Okta" deep link.',
    },
  },
  args: {
    targetTabId: 1,
    oktaOrigin: 'https://example.okta.com',
  },
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        getAllApps: fn(async () => sampleApps),
        getAppAssignmentCounts: fn(async () => ({ users: 128, groups: 4 })),
      }),
    );
  },
} satisfies Meta<typeof AppsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Four applications loaded — the populated list with its toolbar. */
export const Default: Story = {};

/** The inventory load is still in flight — full-panel spinner. */
export const Loading: Story = {
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        getAllApps: fn(() => new Promise<OktaAppListItem[]>(() => {})),
      }),
    );
  },
};

/** An org with no applications — the "nothing loaded" empty state. */
export const Empty: Story = {
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({ getAllApps: fn(async () => [] as OktaAppListItem[]) }),
    );
  },
};

/** The inventory load failed — dismissible `danger` banner above the empty list. */
export const ErrorState: Story = {
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        getAllApps: fn(async () => {
          throw new Error('Failed to fetch apps');
        }),
      }),
    );
  },
};

/** No Okta tab connected — nothing is fetched and Refresh is disabled. */
export const Disconnected: Story = {
  args: { targetTabId: null },
};

/** A larger inventory (60 generated apps), exercising the scrollable list. */
export const LargeInventory: Story = {
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        getAllApps: fn(
          async () =>
            Array.from({ length: 60 }, (_, i) => ({
              id: `0oaFAKE${String(i).padStart(4, '0')}`,
              name: `sample_app_${i}`,
              label: `Sample App ${i + 1}`,
              status: i % 4 === 0 ? 'INACTIVE' : 'ACTIVE',
              signOnMode: i % 3 === 0 ? 'BOOKMARK' : 'SAML_2_0',
              created: '2026-02-01T09:00:00.000Z',
            })) as OktaAppListItem[],
        ),
      }),
    );
  },
};
