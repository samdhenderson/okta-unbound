import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import GroupListItemDetails from './GroupListItemDetails';
import { NavigationProvider } from '../../contexts/NavigationContext';
import type { GroupSummary, PushGroupMapping } from '../../../shared/types';

/**
 * Push targets are `EntityLink` chips, which need a navigation host to be openable —
 * without one every chip degrades to plain text, which would hide the affordance
 * these stories exist to show.
 */
const navigationHandlers = { rule: fn(), group: fn(), user: fn(), app: fn(), policy: fn() };

/** A named push target: the mapping carried the app's label, so the app is openable. */
const namedMapping: PushGroupMapping = {
  mappingId: '0pgFAKE1',
  sourceUserGroupId: '00gFAKEGROUP0001',
  appId: '0oaFAKEAPP000001',
  appName: 'Salesforce',
  targetGroupName: 'eng-team',
  priority: 2,
};

/** The same mapping with no `appName` — the panel knows the app only by its id. */
const unnamedMapping: PushGroupMapping = {
  mappingId: '0pgFAKE2',
  sourceUserGroupId: '00gFAKEGROUP0001',
  appId: '0oaFAKEAPP000002',
  targetGroupName: 'eng-team-mirror',
};

const baseGroup: GroupSummary = {
  id: '00gFAKEGROUP0001',
  name: 'Engineering — All',
  description: 'Everyone in the Engineering org, fed by the department rule.',
  type: 'OKTA_GROUP',
  memberCount: 412,
  hasRules: true,
  ruleCount: 1,
  created: new Date('2024-01-15T09:00:00Z'),
  lastUpdated: new Date('2026-06-01T14:30:00Z'),
};

/**
 * The inline disclosure panel a group row reveals when its chevron is expanded.
 */
const meta = {
  title: 'Groups/GroupListItemDetails',
  component: GroupListItemDetails,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "The preview a group row reveals when its chevron is expanded — the untruncated description, the copyable group id, Okta's own timestamps, the push mappings, and the member-source legend *if* one is already cached.\n\n" +
          'Deliberately a preview and not a second detail view: nothing here fetches, and every field shown is already on the loaded `GroupSummary`. Anything that costs a request lives in the full Group Detail view, which the row body opens.\n\n' +
          "**A push target is named, or its name is stated as missing.** A mapping's `appName` is optional, and this panel used to fall back to printing the raw `appId` in the name's own slot — an opaque `0oa…` that read as though it *were* the app's name. A named mapping is now a shared `EntityLink` (opens the app, copies its id); an un-named one says \"App name not loaded\" beside the raw id in the identifier register.\n\n" +
          '**Related internals:** [EntityLink](?path=/docs/shared-entitylink--docs)',
      },
    },
  },
  decorators: [
    (Story) => (
      <NavigationProvider handlers={navigationHandlers}>
        <div className="max-w-[380px]">
          <Story />
        </div>
      </NavigationProvider>
    ),
  ],
  argTypes: {
    group: { description: 'The group whose record is being previewed.' },
    breakdown: {
      description: 'An already-computed member-source split, or `null` when none is cached.',
    },
  },
  args: {
    group: baseGroup,
    breakdown: null,
  },
} satisfies Meta<typeof GroupListItemDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Description, id and timestamps, with no push mappings on the record. */
export const Default: Story = {};

/**
 * A push mapping whose app came back named. The app opens from the chip, and the
 * copy control names the *id* rather than the app — two apps can share a label,
 * and several mappings can share this panel.
 */
export const NamedPushTarget: Story = {
  args: { group: { ...baseGroup, pushMappings: [namedMapping] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Open app Salesforce' })).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: `Copy application id ${namedMapping.appId}` }),
    ).toBeInTheDocument();
  },
};

/**
 * The same mapping with **no `appName`**. The gap is stated rather than papered
 * over with the id, the id itself is copyable, and the app still **opens** — a
 * valid id is a valid destination whether or not a name came with it (I-017).
 * The stated absence stays un-chipped: a chip is a proven answer, and this is not
 * one.
 */
export const UnnamedPushTarget: Story = {
  args: { group: { ...baseGroup, pushMappings: [unnamedMapping] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('App name not loaded')).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: `Copy application id ${unnamedMapping.appId}` }),
    ).toBeInTheDocument();
    // Retargeted (ADR-0022): the old assertion was that nothing claimed to open an
    // app whose name was never resolved — the capability gap I-017 closed. What still
    // holds, and is what I-003 cared about, is that the id is never presented as a
    // name; the "App name not loaded" assertion above pins that.
    await expect(
      canvas.getByRole('button', {
        name: `App name not loaded — open app ${unnamedMapping.appId}`,
      }),
    ).toBeInTheDocument();
  },
};

/** Both states side by side — the difference has to be legible at a glance. */
export const NamedAndUnnamedPushTargets: Story = {
  args: { group: { ...baseGroup, pushMappings: [namedMapping, unnamedMapping] } },
};

/** An app-sourced group, which names the application it mirrors. */
export const AppSourcedGroup: Story = {
  args: {
    group: {
      ...baseGroup,
      type: 'APP_GROUP',
      sourceAppId: '0oaFAKEAPP000001',
      sourceAppName: 'Salesforce',
      description: undefined,
    },
  },
};

/**
 * A cached member-source split, rendered as the legend. Absent from every other
 * story on purpose: computing one costs a paginated walk per group, so the row
 * shows a meter only when the answer is already banked.
 */
export const WithMemberSourceBreakdown: Story = {
  args: {
    breakdown: {
      total: 412,
      direct: 12,
      ruleBased: 400,
      unattributed: 0,
      byRule: [{ ruleId: '00rFAKERULE00001', ruleName: 'Engineering by department', count: 400 }],
    },
  },
};
