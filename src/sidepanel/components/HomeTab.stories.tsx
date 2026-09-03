import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import HomeTab from './HomeTab';
import { NavigationProvider } from '../contexts/NavigationContext';
import { OrgEntityIndexProvider } from '../contexts/OrgEntityIndexContext';
import { useOktaApi, makeUseOktaApiValue } from '../../../.storybook/mocks/useOktaApi.mock';
import {
  resetSyncSnapshotResponder,
  resetStorageSeed,
  setStorageSeed,
  setSyncSnapshotResponder,
} from '../../../.storybook/mocks/chrome';
import { orgSnapshotStore } from '../../shared/snapshot/orgSnapshotStore';
import { WORKING_SET_STORAGE_KEY } from '../../shared/storage/workingSetStore';
import type { RawOktaGroup } from './groups/groupSummary';
import type { OktaAppListItem } from '../../shared/schemas/okta';
import type { OktaGroupRule } from '../../shared/types';

/** The org these stories render against; the snapshot is scoped by origin. */
const ORIGIN = 'https://example.okta.com';

const ENG_ID = '00gFAKE0000000000001';
const ADA_ID = '00uFAKE0000000000001';

const sampleGroups = [
  {
    id: ENG_ID,
    type: 'OKTA_GROUP',
    profile: { name: 'Engineering', description: 'All engineers' },
  },
  {
    id: '00gFAKE0000000000002',
    type: 'OKTA_GROUP',
    profile: { name: 'Engineering — On-call' },
  },
] as RawOktaGroup[];

const sampleRules = [
  {
    id: '0prFAKE0000000000001',
    name: 'Eng — All ICs',
    status: 'INACTIVE',
    type: 'group_rule',
    created: '2026-01-04T09:00:00.000Z',
    lastUpdated: '2026-05-11T09:00:00.000Z',
  },
] as OktaGroupRule[];

const sampleApps = [
  { id: '0oaFAKE0000000000001', name: 'salesforce', label: 'Salesforce', status: 'ACTIVE' },
] as OktaAppListItem[];

/**
 * Put rows in the org snapshot the way a completed background walk would
 * (ADR-0040). Home resolves ids out of IndexedDB rather than fetching them, so a
 * story stages its content by writing to the real store — which Storybook, in a
 * real browser, actually has.
 *
 * `complete` is the interesting knob: it is what separates "this org has no such
 * group" from "this snapshot cannot say", and the two stories below that differ
 * only in its value cost a different number of requests because of it.
 */
async function seedSnapshot({ complete = true }: { complete?: boolean } = {}): Promise<void> {
  await orgSnapshotStore.clearOrigin(ORIGIN);
  await orgSnapshotStore.upsertMany(
    'groups',
    ORIGIN,
    sampleGroups.map((entity) => ({ id: entity.id, entity })),
    Date.now(),
  );
  await orgSnapshotStore.upsertMany(
    'rules',
    ORIGIN,
    sampleRules.map((entity) => ({ id: entity.id, entity })),
    Date.now(),
  );
  await orgSnapshotStore.patchMeta('groups', ORIGIN, {
    complete,
    lastFullWalkAt: complete ? Date.now() : null,
    itemCount: sampleGroups.length,
  });
  await orgSnapshotStore.upsertMany(
    'apps',
    ORIGIN,
    sampleApps.map((entity) => ({ id: entity.id, entity })),
    Date.now(),
  );
  await orgSnapshotStore.patchMeta('rules', ORIGIN, {
    complete,
    lastFullWalkAt: complete ? Date.now() : null,
    itemCount: sampleRules.length,
  });
  // Apps are seeded complete even in the incomplete case: that story is about
  // one interrupted collection, and leaving a second one unwalked would make
  // the org snapshot card top up and muddy what the story is showing.
  await orgSnapshotStore.patchMeta('apps', ORIGIN, {
    complete: true,
    lastFullWalkAt: Date.now(),
    itemCount: sampleApps.length,
  });
}

/** The four operations Home can reach for, as spies the stories assert against. */
function makeOps() {
  return {
    searchGroups: fn(async (query: string) =>
      query.toLowerCase().startsWith('eng')
        ? [{ id: ENG_ID, name: 'Engineering', description: 'All engineers' }]
        : [],
    ).mockName('searchGroups'),
    searchUsers: fn(async () => [
      {
        id: ADA_ID,
        firstName: 'Ada',
        lastName: 'Lovelace',
        login: 'ada@example.com',
        email: 'ada@example.com',
      },
    ]).mockName('searchUsers'),
    getGroupById: fn(async (id: string) => ({
      id,
      name: 'Engineering',
      description: 'All engineers',
    })).mockName('getGroupById'),
    getUserById: fn(async (id: string) => ({
      id,
      firstName: 'Ada',
      lastName: 'Lovelace',
      login: 'ada@example.com',
      email: 'ada@example.com',
    })).mockName('getUserById'),
  };
}

let ops = makeOps();

/** How many `syncSnapshot` messages the panel sent during a story. */
let syncRequests = 0;

/** The jump field, by the label a screen reader would use to find it. */
const field = (canvasElement: HTMLElement) =>
  within(canvasElement).getByLabelText('Search groups, apps, users, rules');

const meta = {
  title: 'Home/HomeTab',
  component: HomeTab,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    // heading-order disabled: the "nothing matched" `EmptyState` renders an `h3`
    // with no surrounding page heading, which axe reads as a skipped level.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          'The side panel’s first tab. Home replaces the context-aware Overview tab, and the swap ' +
          'is a change of job rather than a redesign: Overview was *passive* — it described whatever ' +
          'entity the browser happened to be showing, and paid for that description with requests on ' +
          'every open. On Home the reader says what they want, and **every fact either arrives free, ' +
          'arrives in one list request, or is a button**.\n\n' +
          'The stories below are about that cost rule, which is the part of Home a screenshot cannot ' +
          'show. Each one asserts the number of Okta requests its interaction actually spends — an ' +
          'id already in the local org snapshot (ADR-0040) resolves at **zero**, a user id at **one** ' +
          'because ADR-0040 §5 deliberately keeps user records out of local storage, and an ' +
          '**incomplete** snapshot spends one rather than reporting an absence it cannot support ' +
          '(ADR-0040 §7).\n\n' +
          'Home has no `PageHeader` — one could only say "Home" — so the jump bar is the first thing ' +
          'in the scroller.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Storage & cache](?path=/docs/internals-storage-cache--docs)',
      },
    },
  },
  decorators: [
    // Home builds its searchers from `canNavigateTo`, so with no provider it can
    // reach nothing and searches nothing. The real app registers group and user.
    //
    // `OrgEntityIndexProvider` stands in for the shell: the snapshot index is
    // mounted once there and read by both Home and the ⌘K palette (`I-033`), so
    // a story renders it with the same arguments `App` passes — including
    // `enabled`, which is what decides whether this tab spends a sync.
    (Story, { args }) => (
      <NavigationProvider handlers={{ group: fn(), user: fn() }}>
        <OrgEntityIndexProvider
          oktaOrigin={args.oktaOrigin ?? null}
          targetTabId={args.targetTabId}
          enabled={args.isActive}
        >
          <Story />
        </OrgEntityIndexProvider>
      </NavigationProvider>
    ),
  ],
  argTypes: {
    isActive: {
      description:
        'Whether Home is the tab on screen. Tabs stay mounted (ADR-0018), so a hidden Home issues no traffic.',
    },
    targetTabId: { description: 'Chrome tab id of the connected Okta tab.' },
    oktaOrigin: { description: 'Okta org origin — scopes the snapshot and builds deep links.' },
  },
  args: {
    isActive: true,
    targetTabId: 1,
    oktaOrigin: ORIGIN,
    onOpenListView: fn(),
    onOpenTab: fn(),
    onScanGroupMfa: fn(),
  },
  beforeEach: async () => {
    resetSyncSnapshotResponder();
    resetStorageSeed();
    ops = makeOps();
    useOktaApi.mockReturnValue(makeUseOktaApiValue(ops));
    await seedSnapshot();
  },
} satisfies Meta<typeof HomeTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Resting state: one empty field, and the placeholder naming what it reaches.
 *
 * The explanatory line that used to sit under the field is gone — it pushed the
 * working set and the org findings down the panel to explain a distinction the
 * bar demonstrates on first use.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(field(canvasElement)).toHaveValue('');
    await expect(field(canvasElement)).toHaveAttribute(
      'placeholder',
      'Search groups, apps, users, rules, etc.',
    );
  },
};

/**
 * A pasted group id, resolved out of the local snapshot. The assertion that
 * matters is the negative one: **`getGroupById` is never called**. A story that
 * only checked the row appeared would pass just as happily if the row had cost a
 * request, which is the one thing this tab promises it does not.
 */
export const IdResolvesWithoutARequest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(field(canvasElement), `${ENG_ID}{Enter}`);

    await expect(await canvas.findByText('Engineering')).toBeInTheDocument();
    await expect(canvas.getByText(/no request/)).toBeInTheDocument();
    await expect(ops.getGroupById).not.toHaveBeenCalled();
  },
};

/**
 * The same interaction with a user id. Users are the org's largest and most
 * personal collection and ADR-0040 §5 keeps them out of local storage on
 * purpose, so this one genuinely costs a read — and the footnote says so rather
 * than repeating the cheaper claim.
 */
export const UserIdCostsOneRequest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(field(canvasElement), `${ADA_ID}{Enter}`);

    await expect(await canvas.findByText('Ada Lovelace')).toBeInTheDocument();
    await expect(canvas.getByText(/1 request/)).toBeInTheDocument();
    await expect(ops.getUserById).toHaveBeenCalledTimes(1);
  },
};

/**
 * An id that is genuinely absent from a **finished** walk. The snapshot can deny
 * it exists, so Home does — still at zero requests, and without asking Okta to
 * confirm an answer it already holds.
 */
export const AbsentIdCostsNothing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(field(canvasElement), '00gFAKE0000000000009{Enter}');

    await expect(await canvas.findByText('Nothing matched')).toBeInTheDocument();
    await expect(ops.getGroupById).not.toHaveBeenCalled();
  },
};

/**
 * The same absent id against an **interrupted** walk. The rows on disk are real
 * but incomplete, so a miss means "not fetched yet" and not "does not exist" —
 * Home spends the request instead of reporting an absence it cannot support.
 * This is ADR-0040 §7's partial-served-as-complete defect, and the guard against
 * it is the only difference between this story and the one above.
 */
export const IncompleteSnapshotFallsThroughToOkta: Story = {
  beforeEach: async () => {
    await seedSnapshot({ complete: false });
  },
  play: async ({ canvasElement }) => {
    await userEvent.type(field(canvasElement), '00gFAKE0000000000009{Enter}');
    await waitFor(() => expect(ops.getGroupById).toHaveBeenCalledTimes(1));
  },
};

/**
 * Typing a name instead. Search fans out over exactly the kinds this build can
 * open, so a result row is never a dead control — and it holds until the third
 * character, so a two-letter pause costs nothing.
 */
export const NameSearch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(field(canvasElement), 'eng');

    await expect(await canvas.findByText('Engineering')).toBeInTheDocument();
    await expect(await canvas.findByText('Ada Lovelace')).toBeInTheDocument();
    // The floor, stated as the absence it is: 'e' and 'en' passed through the
    // field on the way to 'eng' and neither bought a request.
    await expect(ops.searchGroups).not.toHaveBeenCalledWith('e');
    await expect(ops.searchGroups).not.toHaveBeenCalledWith('en');
  },
};

/**
 * A well-formed id **while still typing**. Every intermediate prefix of an id
 * matches nothing, so searching one would spend a request per keystroke to be
 * told so; the bar waits for Enter.
 *
 * The two absences below are the whole story, and they are what it always
 * actually pinned — the copy that used to say so out loud went with the helper
 * line.
 */
export const IdTypedNotYetSubmitted: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(field(canvasElement), ENG_ID);

    await expect(ops.searchGroups).not.toHaveBeenCalled();
    await expect(ops.getGroupById).not.toHaveBeenCalled();
  },
};

/**
 * Home while another tab is on screen. Tabs stay mounted (ADR-0018), so this is
 * the resting state of every section but one at any moment: the field still
 * renders, and the resolver is inert.
 */
export const Inactive: Story = {
  args: { isActive: false },
  play: async ({ canvasElement }) => {
    await userEvent.type(field(canvasElement), 'eng');
    await expect(ops.searchGroups).not.toHaveBeenCalled();
  },
};

/**
 * A working panel. The jump bar is still the first thing in the scroller, but
 * below it sits what the reader pinned and what they were last looking at — so
 * the common case, returning to something you had open ten minutes ago, costs
 * one press and no request at all.
 */
export const WithWorkingSet: Story = {
  beforeEach: async () => {
    setStorageSeed({
      [WORKING_SET_STORAGE_KEY]: {
        version: 1,
        origins: {
          [ORIGIN]: {
            pinned: [
              {
                kind: 'group',
                id: ENG_ID,
                name: 'Engineering',
                lastPane: 'Members',
                lastSeenAt: Date.now(),
              },
            ],
            recent: [
              {
                kind: 'user',
                id: ADA_ID,
                name: 'Ada Lovelace',
                lastPane: 'Profile',
                lastSeenAt: Date.now() - 86_400_000,
              },
            ],
          },
        },
      },
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Engineering')).toBeInTheDocument();
    await expect(await canvas.findByText('Ada Lovelace')).toBeInTheDocument();
    // Pinned and recent are read from storage, not fetched.
    await expect(ops.getGroupById).not.toHaveBeenCalled();
    await expect(ops.getUserById).not.toHaveBeenCalled();
  },
};

/**
 * The same panel with nothing remembered. `Pinned` holds its space and says how
 * to fill it — the pin lives in the corner of a detail header, which nobody
 * looks at until they know it is there.
 */
export const ColdWorkingSet: Story = {
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText(/Nothing pinned yet/)).toBeInTheDocument();
  },
};

/**
 * The org snapshot region, end to end. The counts come from the rows already on
 * disk, so a warm org renders them **without asking the background for
 * anything** — the assertion that no `syncSnapshot` was issued is what makes
 * that claim testable rather than decorative.
 *
 * Home only asks for a top-up when the figures are older than
 * `ORG_FIGURES_MAX_AGE_MS`, and even then it is `sync(false)` — the 0-to-1
 * request ladder, never a walk.
 */
export const OrgFiguresAreFree: Story = {
  beforeEach: async () => {
    setSyncSnapshotResponder(async () => {
      syncRequests += 1;
      return { success: true };
    });
    syncRequests = 0;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The findings and the totals caption both come out of rows already on
    // disk, so a warm org paints the whole card without issuing a request.
    await expect(
      await canvas.findByRole('button', {
        name: 'Open the filtered list',
        description: /Groups with no members/,
      }),
    ).toBeInTheDocument();
    await expect(await canvas.findByRole('button', { name: '2 groups' })).toBeInTheDocument();
    // And so do the reports, off the same handles — no second mount, no second
    // sync ladder. Their presence in the same story is what pins that.
    await expect(await canvas.findByText('Empty groups nothing fills')).toBeInTheDocument();
    await expect(await canvas.findByText('App access no rule maintains')).toBeInTheDocument();
    await waitFor(() => expect(syncRequests).toBe(0));
  },
};

/**
 * The four regions arrive as one cascade, not four independent pops.
 * `useStaggerReveal` marks its container `data-stagger-reveal="on"` only once
 * the `IntersectionObserver` it uses to release the hold actually exists — so
 * seeing the attribute here is proof the hook engaged, not just that a class
 * was typed. `test:storybook` runs this in a real Chromium, where
 * `IntersectionObserver` is real; there is nothing to stub.
 */
export const CardStackCascades: Story = {
  play: async ({ canvasElement }) => {
    const stack = await within(canvasElement).findByTestId('home-card-stack');
    await waitFor(() => expect(stack).toHaveAttribute('data-stagger-reveal', 'on'));
  },
};
