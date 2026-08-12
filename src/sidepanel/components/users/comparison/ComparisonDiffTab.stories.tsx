import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ComparisonDiffTab from './ComparisonDiffTab';
import AppScopeIndicator, { type AppScopeIndicatorState } from './AppScopeIndicator';
import { groupDiffItem, type DiffItem } from './comparisonAnalytics';
import type { GroupMembership } from '../../../../shared/types';

/**
 * Assignment sources for the apps story, by app id — standing in for the
 * `AppEntry.scope` the real Apps tab reads off its live buckets. `a3` is absent
 * on purpose: Okta reported no scope for it.
 */
const appScopes: Record<string, AppScopeIndicatorState> = {
  a1: 'USER',
  a2: 'GROUP',
  a5: 'GROUP',
};

const comparedItems: DiffItem[] = [
  { id: 'g1', label: 'Engineering - Platform' },
  { id: 'g2', label: 'VPN Access' },
  { id: 'g3', label: 'On-call Rotation' },
];

const sharedItems: DiffItem[] = [
  { id: 'g4', label: 'All Employees' },
  { id: 'g5', label: 'Slack Workspace' },
];

const contextItems: DiffItem[] = [{ id: 'g6', label: 'Finance Approvers' }];

/**
 * Group memberships with real provenance, for the story that pins the enriched
 * row shape: one attributed to a rule, one application-managed.
 */
const provenanceMemberships: GroupMembership[] = [
  {
    group: {
      id: '00gFAKEgroup0001',
      type: 'OKTA_GROUP',
      profile: { name: 'VPN Access', description: 'Remote access for contractors' },
    },
    membershipType: 'RULE_BASED',
    rules: [
      {
        id: '0prFAKErule00001',
        name: 'Contractors → VPN Access',
        status: 'ACTIVE',
        conditionExpression: 'user.userType == "Contractor"',
        groupIds: ['00gFAKEgroup0001'],
        userAttributes: ['userType'],
      },
    ],
    attribution: 'exact',
  },
  {
    group: { id: '00gFAKEgroup0002', type: 'APP_GROUP', profile: { name: 'Salesforce Users' } },
    membershipType: 'RULE_BASED',
    rules: [],
    attribution: 'exact',
  },
];

/** Three tone-coded diff buckets (only-compared / shared / only-context) for groups or apps. */
const meta = {
  title: 'Users/Comparison/ComparisonDiffTab',
  component: ComparisonDiffTab,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Three tone-coded diff buckets (only-compared / shared / only-context) for groups or apps.\n\n' +
          'Reused for both the Groups and Apps detail tabs via the `noun` and empty-text props. Optional `renderAction` / `renderContextAction` render-props add per-row "Add" controls to the compared-only and context-only buckets (groups only), enabling one-way or bidirectional copy. Each bucket scrolls within a fixed-height list and shows its empty-state text when the bucket is empty.\n\n' +
          'The optional `renderMeta` render-prop (Apps tab only) adds a per-row detail beside the label and is told **which bucket** the row is in — because an only-compared or only-context row is about one user while a `shared` row is about both, so a facet held for only one side must be renderable differently there.',
      },
    },
  },
  args: {
    contextName: 'Jane Doe',
    comparedName: 'John Smith',
    comparedItems,
    sharedItems,
    contextItems,
    emptyComparedText: 'No groups unique to John Smith.',
    emptySharedText: 'No shared groups.',
    emptyContextText: 'No groups unique to Jane Doe.',
    noun: 'group',
  },
  argTypes: {
    contextName: { description: 'Display name of the context user (baseline).' },
    comparedName: { description: 'Display name of the compared user.' },
    comparedItems: { description: 'Items unique to the compared user (the "add" bucket).' },
    sharedItems: { description: 'Items both users share.' },
    contextItems: { description: 'Items unique to the context user.' },
    emptyComparedText: { description: 'Empty-state text for the only-compared bucket.' },
    emptySharedText: { description: 'Empty-state text for the shared bucket.' },
    emptyContextText: { description: 'Empty-state text for the only-context bucket.' },
    noun: { description: 'Singular noun for the items ("group" or "app"), used in subtitles.' },
    renderAction: {
      description:
        'Optional per-row action for the only-compared bucket (Add to context user); groups only.',
    },
    renderContextAction: {
      description:
        'Optional per-row action for the only-context bucket (Add to compared user); groups only.',
    },
    renderMeta: {
      description:
        "Apps tab only — optional per-row detail rendered beside the label, receiving the bucket the row is in so a caller can answer differently where a bucket holds one user's data rather than both's.",
    },
  },
} satisfies Meta<typeof ComparisonDiffTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default three-bucket diff with a mix of items in each bucket. */
export const Default: Story = {};

/** Groups tab variant with a per-row "Add" action rendered in the compared-only bucket. */
export const WithRowAction: Story = {
  args: {
    renderAction: (item) => (
      <button
        type="button"
        onClick={fn()}
        className="text-xs font-semibold text-primary-text hover:text-primary-dark"
      >
        Add {item.label}
      </button>
    ),
  },
};

/**
 * Bidirectional groups variant: Add actions in BOTH the compared-only bucket
 * (copy onto the context user) and the context-only bucket (copy onto the
 * compared user). Their subtitles flip to read "Add groups to <the other user>".
 */
export const WithBidirectionalActions: Story = {
  args: {
    renderAction: (item) => (
      <button
        type="button"
        onClick={fn()}
        className="text-xs font-semibold text-primary-text hover:text-primary-dark"
      >
        Add {item.label} to Jane Doe
      </button>
    ),
    renderContextAction: (item) => (
      <button
        type="button"
        onClick={fn()}
        className="text-xs font-semibold text-primary-text hover:text-primary-dark"
      >
        Add {item.label} to John Smith
      </button>
    ),
  },
};

/** All three buckets empty (identical or brand-new users). */
export const Empty: Story = {
  args: {
    comparedItems: [],
    sharedItems: [],
    contextItems: [],
  },
};

/** Apps tab: no row action, different noun and copy. */
export const AppsVariant: Story = {
  args: {
    noun: 'app',
    emptyComparedText: 'No apps unique to John Smith.',
    emptySharedText: 'No shared apps.',
    emptyContextText: 'No apps unique to Jane Doe.',
  },
};

/**
 * The Apps tab as `UserComparisonView` renders it: every row states how Okta
 * reports its assignment, via `renderMeta` and {@link AppScopeIndicator}.
 *
 * Note the three registers. Only-compared / only-context rows are about one user,
 * so they carry that user's scope (or an explicit "Source unknown" when Okta
 * reported none). Shared rows are about *both* users but the buckets carry only
 * the compared user's scope, so they say "Source not compared" rather than
 * presenting one user's source as if it described both.
 */
export const AppsWithAssignmentSource: Story = {
  args: {
    noun: 'app',
    comparedItems: [
      { id: 'a1', label: 'Directly Assigned App' },
      { id: 'a2', label: 'Group Granted App' },
      { id: 'a3', label: 'App Okta Reported No Source For' },
    ],
    sharedItems: [{ id: 'a4', label: 'Shared App' }],
    contextItems: [{ id: 'a5', label: 'Context-only App' }],
    emptyComparedText: 'No apps unique to John Smith.',
    emptySharedText: 'No shared apps.',
    emptyContextText: 'No apps unique to Jane Doe.',
    renderMeta: (item, bucket) => {
      if (bucket === 'shared') return <AppScopeIndicator state="notCompared" />;
      return <AppScopeIndicator state={appScopes[item.id] ?? 'unknown'} />;
    },
  },
};

/**
 * Group rows built by `groupDiffItem`, so each carries its whole
 * {@link GroupMembership} on `DiffItem.membership` — including a rule-based row
 * whose `rules` and `attribution` say *why* the user holds the group.
 *
 * Renders identically to {@link Default} on purpose: phase 3.6 only delivers the
 * provenance to the row, and the two-line row that states it lands in 3.7. This
 * story exists to pin the enriched shape (and to give 3.7 its fixture).
 */
export const GroupRowsCarryProvenance: Story = {
  args: {
    comparedItems: provenanceMemberships.map(groupDiffItem),
    sharedItems: [],
    contextItems: [],
  },
};

/** A bucket with many items scrolls within its fixed-height list. */
export const LongLists: Story = {
  args: {
    comparedItems: Array.from({ length: 20 }, (_, i) => ({
      id: `long-${i}`,
      label: `Group with a fairly long descriptive name #${i + 1}`,
    })),
  },
};
