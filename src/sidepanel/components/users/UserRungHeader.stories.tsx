import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import UserRungHeader from './UserRungHeader';
import type { OktaUser } from '../../../shared/types';
import type { ViewStack, ViewStackCrumb } from '../../hooks/useViewStack';
import type { UsersViewEntry } from '../../hooks/useUsersTabState';

/** An obviously fake user — no real org data ever ships in a story. */
const user: OktaUser = {
  id: '00uFAKE00000000000001',
  status: 'ACTIVE',
  created: '2024-03-11T09:12:00.000Z',
  lastLogin: '2026-08-17T08:41:00.000Z',
  profile: {
    login: 'user@example.com',
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: 'Platform Engineering',
    title: 'Staff Engineer',
  },
};

/** The name most likely to wrap the `<h1>` at 360px, plus a longer status word. */
const longNameUser: OktaUser = {
  ...user,
  id: '00uFAKE00000000000002',
  status: 'PROVISIONED',
  profile: {
    ...user.profile,
    firstName: 'Wilhelmina-Constance',
    lastName: 'Featherstonehaugh-Villanueva',
  },
};

/**
 * A stand-in for the tab's real `useViewStack`. The header only reads the stack —
 * `currentEntry`, `isRoot`, `trail`, `pop` — so a plain object is the whole
 * contract, and a story that instantiated the hook would be testing the hook.
 */
const makeNav = (entries: UsersViewEntry[]): ViewStack<UsersViewEntry> => {
  const trail: ViewStackCrumb[] = [
    {
      key: 'root',
      label: 'User Search',
      depth: 0,
      isCurrent: entries.length === 0,
      ...(entries.length === 0 ? {} : { onSelect: fn() }),
    },
    ...entries.map((entry, index) => ({
      key: `${entry.kind}-${entry.userId}`,
      label: entry.kind === 'compare' ? 'Compare users' : entry.userName,
      depth: index + 1,
      isCurrent: index === entries.length - 1,
      ...(index === entries.length - 1 ? {} : { onSelect: fn() }),
    })),
  ];

  return {
    entries,
    currentEntry: entries[entries.length - 1],
    depth: entries.length,
    isRoot: entries.length === 0,
    trail,
    transition: null,
    push: fn(),
    pop: fn(),
    popTo: fn(),
    reset: fn(),
  };
};

const searchNav = makeNav([]);
const detailNav = makeNav([{ kind: 'detail', userId: user.id, userName: 'Ada Lovelace' }]);
const longNameNav = makeNav([
  {
    kind: 'detail',
    userId: longNameUser.id,
    userName: 'Wilhelmina-Constance Featherstonehaugh-Villanueva',
  },
]);
const compareNav = makeNav([
  { kind: 'detail', userId: user.id, userName: 'Ada Lovelace' },
  { kind: 'compare', userId: user.id, userName: 'Ada Lovelace' },
]);

/** What the Users tab's one `PageHeader` says on each rung of its view stack. */
const meta = {
  title: 'Users/UserRungHeader',
  component: UserRungHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Users tab keeps **one** `PageHeader` mounted and swaps its contents as views are ' +
          'pushed and popped (ADR-0008, ADR-0016). This is that swap, extracted so the tab shell ' +
          'stays composition.\n\n' +
          'Three rungs, three subjects: **search** shows the stack’s own root label; **detail** ' +
          'shows the user’s display name plus the identity region built by `userIdentity`; ' +
          '**compare** shows `Compare users`, because the subject there is *two* users and ' +
          'describing one of them would be wrong.\n\n' +
          '**An unloaded count is absent, not `0`.** The apps metric only appears once the Apps ' +
          'pane has resolved the full assignment list; `appCount: undefined` drops the fact ' +
          'entirely, because a user with no apps and a user whose apps have not been fetched are ' +
          'different answers and only one of them is zero (ADR-0032 §2a). The group count follows ' +
          'the same rule while memberships load.\n\n' +
          'The header describes a user **only** on the detail rung, and only once the loaded user ' +
          'is the one that rung is for — otherwise the push-time snapshot name still stands and a ' +
          'status badge would belong to somebody else. It never falls back to the entity detected ' +
          'on the live Okta tab: that is `ContextBar`’s subject, and the two must not converge ' +
          '(ADR-0032 §1).\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Components](?path=/docs/internals-components--docs)',
      },
    },
  },
  decorators: [
    (Story: () => React.ReactElement) => (
      <div className="bg-canvas">
        <Story />
      </div>
    ),
  ],
  args: {
    nav: detailNav,
    isDetailOpen: true,
    isCompareOpen: false,
    selectedUser: user,
    membershipCount: 12,
    isLoadingMemberships: false,
    appCount: undefined,
    oktaOrigin: 'https://example.okta.com',
    isActive: true,
  },
  argTypes: {
    nav: { description: 'The tab’s sub-navigation stack: search → a user’s detail → comparison.' },
    isDetailOpen: { description: 'Whether a user’s detail page is the view on screen.' },
    isCompareOpen: { description: 'Whether a comparison is the view on screen.' },
    selectedUser: { description: 'The user the tab has loaded, or `null`.' },
    membershipCount: { description: 'How many groups that user is in.' },
    isLoadingMemberships: {
      description: 'True while memberships load — the group count is then omitted, not zeroed.',
    },
    appCount: {
      description:
        'How many apps the user has, once the Apps pane resolved them. `undefined` omits the fact rather than rendering a zero.',
    },
    oktaOrigin: {
      description: 'Origin for the header’s "Open in Okta" link; it hides without one.',
    },
    isActive: {
      description:
        'Whether the Users tab is the visible one. Passed to `sticky`, so a hidden panel never publishes a stale `--header-h`.',
    },
  },
} satisfies Meta<typeof UserRungHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The detail rung, with memberships loaded and the apps count not yet known. */
export const Default: Story = {};

/** The root rung: no identity region, no breadcrumbs, and the tab’s own subtitle. */
export const SearchRung: Story = {
  args: {
    nav: searchNav,
    isDetailOpen: false,
    selectedUser: null,
    membershipCount: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'User Search' }),
    ).toBeInTheDocument();
  },
};

/**
 * **The point of the component.** The Apps pane has not answered yet, so there is
 * no apps metric at all — not `0 apps`. A user with no apps and a user whose apps
 * were never fetched are different answers.
 */
export const DetailWithoutAppsMetric: Story = {
  args: { appCount: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('12')).toBeInTheDocument();
    await expect(canvas.queryByText('apps')).toBeNull();
    await expect(canvas.queryByText('app')).toBeNull();
  },
};

/** The same rung once the Apps pane resolved: the metric appears, stating a fact. */
export const DetailWithAppsMetric: Story = {
  args: { appCount: 7 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('apps')).toBeInTheDocument();
  },
};

/** Exactly one app: the metric pluralises with the number rather than saying `1 apps`. */
export const DetailWithOneApp: Story = {
  args: { appCount: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('app')).toBeInTheDocument();
  },
};

/** Memberships still loading, so the group count is omitted on the same principle. */
export const Loading: Story = {
  args: { isLoadingMemberships: true, appCount: undefined },
};

/**
 * A long display name at full width. The `<h1>` is the anchor the whole panel is
 * read against, so the status badge sits in the trailing cluster rather than
 * beside the title where it would cost the name a line.
 */
export const LongDisplayName: Story = {
  args: { nav: longNameNav, selectedUser: longNameUser, membershipCount: 41, appCount: 23 },
};

/**
 * The comparison rung. The subject is *two* users, so there is no identity region
 * at all — describing one of them here would be a claim about the wrong entity.
 */
export const CompareRung: Story = {
  args: { nav: compareNav, isCompareOpen: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Compare users' }),
    ).toBeInTheDocument();
  },
};

/**
 * The pushed entry is a snapshot taken at push time, and the loaded user is not
 * (yet) the one this rung is for. The snapshot name stands and no identity is
 * described, rather than a status badge belonging to somebody else.
 */
export const SnapshotNameOnly: Story = {
  args: { selectedUser: null },
};

/** No org origin, so the header carries no "Open in Okta" action rather than a broken one. */
export const WithoutOktaOrigin: Story = {
  args: { oktaOrigin: null, appCount: 7 },
};

/**
 * The 360px floor, where the title, the status badge and the identity facts all
 * compete. This is why `badge` renders in the trailing cluster: a badge beside
 * the `<h1>` costs the title two lines of wrapping.
 */
export const Compact: Story = {
  args: { nav: longNameNav, selectedUser: longNameUser, membershipCount: 41, appCount: 23 },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
