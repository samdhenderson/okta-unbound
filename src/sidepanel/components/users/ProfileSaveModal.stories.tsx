import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import ProfileSaveModal from './ProfileSaveModal';
import type {
  BlastRadiusReport as BlastRadiusReportData,
  GroupEffect,
  RuleEffect,
} from '../../../shared/membership/blastRadiusTypes';
import type { DraftChange } from './profileDraft';

/** Obviously fake ids — no real org data ever ships in a story. */
const SALES_RULE = '0prFAKErule00001';
const ENG_RULE = '0prFAKErule00002';

const change = (over: Partial<DraftChange> = {}): DraftChange => ({
  name: 'department',
  label: 'Department',
  beforeDisplay: 'Engineering',
  afterDisplay: 'Sales',
  afterRaw: 'Sales',
  changesSignIn: false,
  ...over,
});

/** One ordinary attribute move. */
const ONE_CHANGE: DraftChange[] = [change()];

/** A realistic multi-attribute edit: a move, a retitle, a first-ever value, a clear. */
const SEVERAL_CHANGES: DraftChange[] = [
  change(),
  change({
    name: 'title',
    label: 'Title',
    beforeDisplay: 'Staff Engineer, Platform Infrastructure',
    afterDisplay: 'Sales Engineer, Enterprise',
    afterRaw: 'Sales Engineer, Enterprise',
  }),
  change({
    name: 'costCenter',
    label: 'Cost center',
    beforeDisplay: '',
    afterDisplay: 'CC-2140',
    afterRaw: 'CC-2140',
  }),
  change({
    name: 'managerId',
    label: 'Manager ID',
    beforeDisplay: '00uFAKE0000000000001',
    afterDisplay: '',
    afterRaw: '',
  }),
];

/** The one change that alters how the person gets in. */
const LOGIN_CHANGE: DraftChange[] = [
  change({
    name: 'login',
    label: 'Login',
    beforeDisplay: 'ada@example.com',
    afterDisplay: 'a.lovelace@example.com',
    afterRaw: 'a.lovelace@example.com',
    changesSignIn: true,
  }),
  change(),
];

const GROUPS: GroupEffect[] = [
  {
    groupId: '00gFAKE00000000000001',
    groupName: 'Sales-All',
    kind: 'likely-added',
    ruleId: SALES_RULE,
    ruleName: 'Sales auto-add',
    contributingRuleIds: [SALES_RULE],
    currentlyHeld: false,
  },
  {
    groupId: '00gFAKE00000000000002',
    groupName: 'Engineering-All',
    kind: 'likely-removed',
    ruleId: ENG_RULE,
    ruleName: 'Eng auto-add',
    contributingRuleIds: [ENG_RULE],
    currentlyHeld: true,
    currentBucket: 'rule',
  },
  {
    groupId: '00gFAKE00000000000003',
    groupName: 'Contractors',
    kind: 'not-predicted',
    contributingRuleIds: [ENG_RULE],
    withheldReason: 'membership-not-credited-to-rule',
    currentlyHeld: true,
    currentBucket: 'direct',
  },
];

const RULES: RuleEffect[] = [
  {
    ruleId: SALES_RULE,
    ruleName: 'Sales auto-add',
    expression: 'user.department == "Sales"',
    transition: 'starts-matching',
    targetGroupIds: ['00gFAKE00000000000001'],
    targetGroupNames: ['Sales-All'],
    touchedAttributes: ['department'],
    active: true,
  },
  {
    ruleId: ENG_RULE,
    ruleName: 'Eng auto-add',
    expression: 'user.department == "Engineering"',
    transition: 'stops-matching',
    targetGroupIds: ['00gFAKE00000000000002'],
    targetGroupNames: ['Engineering-All'],
    touchedAttributes: ['department'],
    active: true,
  },
  {
    ruleId: '0prFAKErule00003',
    ruleName: 'Everyone',
    expression: 'user.status == "ACTIVE"',
    transition: 'unchanged-match',
    targetGroupIds: ['00gFAKE00000000000005'],
    targetGroupNames: ['Everyone'],
    touchedAttributes: [],
    active: true,
  },
];

const EMPTY = (status: BlastRadiusReportData['status']): BlastRadiusReportData => ({
  status,
  groups: [],
  rules: [],
  counts: { added: 0, removed: 0, notPredicted: 0, starts: 0, stops: 0, undetermined: 0 },
  secondOrderPossible: false,
  secondOrderRuleNames: [],
});

const COMPUTED: BlastRadiusReportData = {
  status: 'computed',
  groups: GROUPS,
  rules: RULES,
  counts: { added: 1, removed: 1, notPredicted: 1, starts: 1, stops: 1, undetermined: 0 },
  secondOrderPossible: false,
  secondOrderRuleNames: [],
};

/** The last thing between an admin's profile edits and a live write to Okta. */
const meta = {
  title: 'Users/ProfileSaveModal',
  component: ProfileSaveModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '**A confirmation that restates rather than summarises.** By the time an admin has typed into four ' +
          'fields they are looking at four *new* values and no longer at the old ones, so every changed ' +
          'attribute is listed with both sides. The two states a form cannot show are given words instead of ' +
          'blanks: an unset prior value reads `— not set`, an emptied new value reads `— cleared`. A blank ' +
          'cell beside an arrow reads as a rendering bug, and “cleared” is a decision an admin must be able ' +
          'to see they made. Values wrap and never truncate — a clipped value beside a `→` is misleading ' +
          'about what is being written.\n\n' +
          '**`login` gets its own warning.** Every other attribute in a profile is data *about* a person; ' +
          '`login` is how that person gets in. `DraftChange.changesSignIn` marks it, and this surface raises ' +
          'it to a `danger` alert **in addition to** the ordinary overwrite warning, never as one more line ' +
          'in the list, because the consequence lands on someone who is not in the room.\n\n' +
          '**The analysis is opt-in and offered once.** The draft cannot change while the modal is open, so ' +
          'the report can only ever be computed once for it — the button is replaced by its answer rather ' +
          'than becoming a re-run of a question with a fixed answer. `BlastRadiusReport` renders nothing ' +
          'under `not-computed`, so it is mounted unconditionally beneath the button.\n\n' +
          '**Presentational only.** The draft, the diff and the request live in `useProfileEdit`; the ' +
          'prediction lives in `useBlastRadius`. This component takes `report` / `onAnalyze` / `isAnalyzing` ' +
          'as props, which is why every state below is a story rather than a scenario.\n\n' +
          'Related internals: `sidepanel/hooks/useProfileEdit`, `sidepanel/hooks/useBlastRadius`, ' +
          '`sidepanel/components/users/profileDraft`.',
      },
    },
  },
  args: {
    changes: ONE_CHANGE,
    userName: 'Ada Lovelace',
    onCancel: fn(),
    onConfirm: fn(),
    isSaving: false,
    report: EMPTY('not-computed'),
    onAnalyze: fn(),
    isAnalyzing: false,
  },
  argTypes: {
    changes: {
      description:
        'The changes awaiting confirmation — non-null opens the modal. Untrusted tenant data; never logged.',
    },
    userName: { description: 'Whose profile this is, for the warning sentence. **PII.**' },
    onCancel: { description: 'Dismiss without writing. Also fires on Escape and overlay click.' },
    onConfirm: { description: 'Perform the write.' },
    isSaving: {
      description: 'Loads the confirm button and locks Cancel while the write is in flight.',
    },
    report: { description: 'The blast-radius report; `not-computed` renders nothing at all.' },
    onAnalyze: { description: 'Run the analysis. Pure, synchronous, and costs no API calls.' },
    isAnalyzing: { description: 'Loads the Analyze button while the engine runs.' },
    error: { description: 'A previous failed attempt, kept on screen so the admin can retry.' },
  },
} satisfies Meta<typeof ProfileSaveModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * One attribute moving. The analysis has not been asked for, so nothing is
 * claimed about group access beyond the fact that it could move.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('dialog', { name: 'Save profile changes?' })).toBeInTheDocument();
    await expect(
      canvas.getByText(/1 attribute on Ada Lovelace will be overwritten/i),
    ).toBeInTheDocument();
    await expect(canvas.getByText('Engineering')).toBeInTheDocument();
    await expect(canvas.getByText('Sales')).toBeInTheDocument();

    // Nothing is claimed before anybody asks.
    await expect(canvas.getByRole('button', { name: 'Analyze blast radius' })).toBeEnabled();
    await expect(canvas.queryByRole('button', { name: /^Groups/ })).toBeNull();
  },
};

/**
 * A four-attribute edit, including the two shapes a form cannot show on its own:
 * an attribute that had no value before, and one being emptied.
 */
export const SeveralChanges: Story = {
  args: { changes: SEVERAL_CHANGES },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByText(/4 attributes on Ada Lovelace will be overwritten/i),
    ).toBeInTheDocument();
    await expect(canvas.getByText('— not set')).toBeInTheDocument();
    await expect(canvas.getByText('— cleared')).toBeInTheDocument();
    // The long title wraps rather than truncating; both sides stay readable.
    await expect(canvas.getByText('Staff Engineer, Platform Infrastructure')).toBeInTheDocument();
  },
};

/**
 * The login is changing. A second, louder warning appears above the list and the
 * row itself is marked, so the warning has something to point at.
 */
export const SignInChange: Story = {
  args: { changes: LOGIN_CHANGE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(/This changes how Ada Lovelace signs in/i)).toBeInTheDocument();
    await expect(canvas.getByText('Sign-in')).toBeInTheDocument();
    // Additional to, never instead of, the ordinary overwrite warning.
    await expect(
      canvas.getByText(/2 attributes on Ada Lovelace will be overwritten/i),
    ).toBeInTheDocument();
  },
};

/** The engine is running. The button holds its place rather than vanishing mid-answer. */
export const Analyzing: Story = {
  args: { isAnalyzing: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Analyze blast radius' })).toBeDisabled();
  },
};

/**
 * The answer arrived: a group likely gained, one likely lost, and one the engine
 * declined to call. The Analyze button is gone — the draft is frozen while this
 * modal is open, so re-asking could only return the same report.
 */
export const Analyzed: Story = {
  args: { changes: SEVERAL_CHANGES, report: COMPUTED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByRole('button', { name: 'Analyze blast radius' })).toBeNull();
    await expect(canvas.getByRole('heading', { name: 'Likely added' })).toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: 'Likely removed' })).toBeInTheDocument();
    await expect(canvas.getByText('Sales-All')).toBeInTheDocument();

    // The cause is one pill away, and nothing recomputes on the switch.
    await userEvent.click(canvas.getByRole('button', { name: 'Rules 2' }));
    await expect(canvas.getByRole('heading', { name: 'Starts matching' })).toBeInTheDocument();
  },
};

/**
 * The org's rule inventory could not be loaded, so no prediction is possible.
 * That is a finding, not a quiet "no changes" — and the save is still offered,
 * because an admin may legitimately proceed without a forecast.
 */
export const AnalysisUnavailable: Story = {
  args: { report: EMPTY('unavailable') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/not the same as predicting no change/i)).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  },
};

/** The write failed. The dialog stays open with its changes intact so the admin can retry. */
export const SaveError: Story = {
  args: {
    changes: LOGIN_CHANGE,
    error: 'Okta rejected the update: that login is already in use.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/that login is already in use/i)).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  },
};

/** The write is in flight. Both footer controls lock, so the request cannot be doubled. */
export const Saving: Story = {
  args: { isSaving: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  },
};

/**
 * The 360px floor — where the panel actually lives. The `before → after` line
 * wraps instead of truncating, and the footer keeps both actions on one row.
 */
export const Compact: Story = {
  args: { changes: SEVERAL_CHANGES, report: COMPUTED },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
