import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import AppsTab from './AppsTab';
import { useOktaApi, makeUseOktaApiValue } from '../../../.storybook/mocks/useOktaApi.mock';
import {
  setSyncSnapshotResponder,
  resetSyncSnapshotResponder,
} from '../../../.storybook/mocks/chrome';
import { orgSnapshotStore } from '../../shared/snapshot/orgSnapshotStore';
import type { OktaAppListItem } from '../../shared/schemas/okta';

/** The org these stories render against; the snapshot is scoped by origin. */
const ORIGIN = 'https://example.okta.com';

/**
 * Put an inventory in the org snapshot, the way a completed background walk
 * would (ADR-0040).
 *
 * The tab reads its rows from IndexedDB rather than fetching them, so a story
 * stages its content by writing to the real store — which Storybook, running in
 * a real browser, actually has. Each story starts by clearing the origin, since
 * the store outlives a story the way it outlives a panel session.
 */
async function seedInventory(apps: OktaAppListItem[]): Promise<void> {
  await orgSnapshotStore.clearOrigin(ORIGIN);
  if (apps.length > 0) {
    await orgSnapshotStore.upsertMany(
      'apps',
      ORIGIN,
      apps.map((entity) => ({ id: entity.id, entity })),
      Date.now(),
    );
  }
  await orgSnapshotStore.patchMeta('apps', ORIGIN, {
    complete: true,
    lastFullWalkAt: Date.now(),
    itemCount: apps.length,
  });
}

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
          'Read-only by construction — the inventory comes from the background-owned org snapshot ' +
          '(ADR-0040), and the tab reaches for the API only (lazily, per expanded row) via ' +
          '`getAppAssignmentCounts`. A failed load surfaces as a dismissible `danger` banner ' +
          'rather than an empty list presented as complete.\n\n' +
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
  beforeEach: async () => {
    resetSyncSnapshotResponder();
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        getAppAssignmentCounts: fn(async () => ({ users: 128, groups: 4 })),
      }),
    );
    await seedInventory(sampleApps);
  },
} satisfies Meta<typeof AppsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Four applications loaded — the populated list with its toolbar. */
export const Default: Story = {
  // The rows come from IndexedDB, not from a mocked fetch, so this asserts the
  // seed actually reached the screen. Without it the story would still "pass"
  // while silently rendering the empty state — which is exactly how the
  // ADR-0040 retarget could have gone unnoticed.
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Salesforce')).toBeInTheDocument();
  },
};

/** The inventory sync is still in flight — full-panel spinner. */
export const Loading: Story = {
  beforeEach: async () => {
    await seedInventory([]);
    setSyncSnapshotResponder(() => new Promise<unknown>(() => {}));
  },
};

/** An org with no applications — the "nothing loaded" empty state. */
export const Empty: Story = {
  beforeEach: async () => {
    await seedInventory([]);
  },
};

/** The inventory load failed — dismissible `danger` banner above the empty list. */
export const ErrorState: Story = {
  beforeEach: async () => {
    await seedInventory([]);
    setSyncSnapshotResponder(async () => ({ success: false, error: 'Failed to fetch apps' }));
  },
};

/** No Okta tab connected — nothing is fetched and Refresh is disabled. */
export const Disconnected: Story = {
  args: { targetTabId: null },
};

/** A larger inventory (60 generated apps), exercising the scrollable list. */
export const LargeInventory: Story = {
  beforeEach: async () => {
    await seedInventory(
      Array.from({ length: 60 }, (_, i) => ({
        id: `0oaFAKE${String(i).padStart(4, '0')}`,
        name: `sample_app_${i}`,
        label: `Sample App ${i + 1}`,
        status: i % 4 === 0 ? 'INACTIVE' : 'ACTIVE',
        signOnMode: i % 3 === 0 ? 'BOOKMARK' : 'SAML_2_0',
        created: '2026-02-01T09:00:00.000Z',
      })) as OktaAppListItem[],
    );
  },
};
