import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileSaveModal from './ProfileSaveModal';
import type { ProfileSaveModalProps } from './ProfileSaveModal';
import type {
  BlastRadiusReport as BlastRadiusReportData,
  GroupEffect,
} from '../../../shared/membership/blastRadiusTypes';
import type { DraftChange } from './profileDraft';

/**
 * Behaviour tests for the confirm step between a profile edit and a live write.
 *
 * The component is presentational — it owns no draft, issues no request and
 * never calls `useBlastRadius` — so every assertion here is about what an admin
 * can read on the dialog or which callback a control fires. The real
 * `BlastRadiusReport` is rendered rather than mocked, so "the report is not
 * shown before it is computed" is asserted against actual output.
 */
const change = (over: Partial<DraftChange> = {}): DraftChange => ({
  name: 'department',
  label: 'Department',
  beforeDisplay: 'Engineering',
  afterDisplay: 'Sales',
  afterRaw: 'Sales',
  changesSignIn: false,
  ...over,
});

const emptyReport = (status: BlastRadiusReportData['status']): BlastRadiusReportData => ({
  status,
  groups: [],
  rules: [],
  counts: { added: 0, removed: 0, notPredicted: 0, starts: 0, stops: 0, undetermined: 0 },
  secondOrderPossible: false,
  secondOrderRuleNames: [],
});

const SALES_GROUP: GroupEffect = {
  groupId: '00gFAKE00000000000001',
  groupName: 'Sales-All',
  kind: 'likely-added',
  ruleId: '0prFAKErule00001',
  ruleName: 'Sales auto-add',
  contributingRuleIds: ['0prFAKErule00001'],
  currentlyHeld: false,
};

const computedReport: BlastRadiusReportData = {
  ...emptyReport('computed'),
  status: 'computed',
  groups: [SALES_GROUP],
  counts: { added: 1, removed: 0, notPredicted: 0, starts: 0, stops: 0, undetermined: 0 },
};

function renderModal(over: Partial<ProfileSaveModalProps> = {}) {
  const props: ProfileSaveModalProps = {
    changes: [change()],
    userName: 'Ada Lovelace',
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    isSaving: false,
    report: emptyReport('not-computed'),
    onAnalyze: vi.fn(),
    isAnalyzing: false,
    ...over,
  };
  return { props, ...render(<ProfileSaveModal {...props} />) };
}

describe('ProfileSaveModal', () => {
  it('is closed while there is nothing pending, and open once there is', () => {
    const { rerender, props } = renderModal({ changes: null });
    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(<ProfileSaveModal {...props} changes={[change()]} />);
    expect(screen.getByRole('dialog', { name: 'Save profile changes?' })).toBeInTheDocument();
  });

  it('lists every change with both the value being replaced and the one replacing it', () => {
    renderModal({
      changes: [
        change(),
        change({
          name: 'title',
          label: 'Title',
          beforeDisplay: 'Staff Engineer',
          afterDisplay: 'Sales Engineer',
          afterRaw: 'Sales Engineer',
        }),
      ],
    });

    const rows = screen.getAllByRole('listitem');
    const department = rows.find((row) => within(row).queryByText('Department') !== null);
    const title = rows.find((row) => within(row).queryByText('Title') !== null);

    expect(department).toBeDefined();
    expect(within(department as HTMLElement).getByText('Engineering')).toBeInTheDocument();
    expect(within(department as HTMLElement).getByText('Sales')).toBeInTheDocument();

    expect(title).toBeDefined();
    expect(within(title as HTMLElement).getByText('Staff Engineer')).toBeInTheDocument();
    expect(within(title as HTMLElement).getByText('Sales Engineer')).toBeInTheDocument();
  });

  it('names an unset prior value and a cleared new value rather than leaving the cell blank', () => {
    renderModal({
      changes: [
        change({ beforeDisplay: '', afterDisplay: 'Sales' }),
        change({
          name: 'costCenter',
          label: 'Cost center',
          beforeDisplay: 'CC-1000',
          afterDisplay: '',
          afterRaw: '',
        }),
      ],
    });

    expect(screen.getByText('— not set')).toBeInTheDocument();
    expect(screen.getByText('— cleared')).toBeInTheDocument();
  });

  it('warns separately about sign-in only when a change alters the login', async () => {
    const user = userEvent.setup();
    const { rerender, props } = renderModal();

    expect(screen.queryByText(/signs in/i)).toBeNull();

    rerender(
      <ProfileSaveModal
        {...props}
        changes={[
          change({
            name: 'login',
            label: 'Login',
            beforeDisplay: 'ada@example.com',
            afterDisplay: 'a.lovelace@example.com',
            afterRaw: 'a.lovelace@example.com',
            changesSignIn: true,
          }),
        ]}
      />,
    );

    expect(screen.getByText(/This changes how Ada Lovelace signs in/i)).toBeInTheDocument();
    // And the row itself is marked, so the warning has something to point at.
    expect(screen.getByText('Sign-in')).toBeInTheDocument();

    // The ordinary overwrite warning still stands alongside it.
    expect(
      screen.getByText(/1 attribute on Ada Lovelace will be overwritten/i),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
  });

  it('asks for the analysis on request, and shows no report until one is computed', async () => {
    const user = userEvent.setup();
    const { rerender, props } = renderModal();

    // Nothing is claimed before anybody asks.
    expect(screen.queryByRole('button', { name: /^Groups/ })).toBeNull();
    expect(screen.queryByText('Sales-All')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Analyze blast radius' }));
    expect(props.onAnalyze).toHaveBeenCalledTimes(1);

    rerender(<ProfileSaveModal {...props} report={computedReport} />);

    expect(screen.getByText('Sales-All')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Likely added' })).toBeInTheDocument();
    // Asked and answered: the draft cannot change here, so the question is retired.
    expect(screen.queryByRole('button', { name: 'Analyze blast radius' })).toBeNull();
  });

  it('disables the analyze button while the analysis runs', () => {
    renderModal({ isAnalyzing: true });
    expect(screen.getByRole('button', { name: 'Analyze blast radius' })).toBeDisabled();
  });

  it('confirms and cancels from the footer', async () => {
    const user = userEvent.setup();
    const { props } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('locks both footer controls while the write is in flight', () => {
    renderModal({ isSaving: true });

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('shows the failure of a previous attempt without closing', () => {
    renderModal({ error: 'Okta rejected the update: login is already in use.' });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText('Okta rejected the update: login is already in use.'),
    ).toBeInTheDocument();
    // Still armed, so the admin can correct and retry.
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
});
