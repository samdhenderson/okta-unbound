/**
 * @module sidepanel/hooks/useComparisonProfileEdit.test
 * @description What the two-column editor does that neither `useProfileEdit` nor
 * a rendered story can state: that the columns are independent, that a column
 * with nowhere to publish a save offers no editing at all, and that the one
 * confirmation on screen survives its own write and says the right thing about
 * each of the three outcomes.
 *
 * The real `useProfileEdit` and `useBlastRadius` run here — mocking them would
 * leave the composition, which is the entire subject, untested. Only the edges
 * are mocked: the `useOktaApi` facade (this repo has no MSW), the undo history,
 * the entity cache, and the group-name cache read.
 *
 * Security: every fixture uses fake identifiers (`00uFAKE…`, `@example.com`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { GroupMembership, OktaUser } from '../../shared/types';
import type { OktaUserSchemaProperty } from '../../shared/schemas/okta';

const api = vi.hoisted(() => ({
  updateUserProfile: vi.fn(),
}));

vi.mock('./useOktaApi', () => ({ useOktaApi: () => api }));
vi.mock('../../shared/undoManager', () => ({ logProfileUpdateAction: vi.fn() }));
vi.mock('../cache/entityCache', () => ({ invalidate: vi.fn() }));
vi.mock('./fetchGroupRulesRequest', () => ({
  loadCachedGroupNames: vi.fn(async () => new Map<string, string>()),
}));

import {
  useComparisonProfileEdit,
  type UseComparisonProfileEditOptions,
} from './useComparisonProfileEdit';
import type { AttributeDescriptor } from '../components/users/profileAttributes';

/** A `READ_WRITE`, Okta-mastered string property — the editable case. */
const writable: OktaUserSchemaProperty = {
  type: 'string',
  mutability: 'READ_WRITE',
  master: { type: 'OKTA' },
};

const makeUser = (id: string, department: string): OktaUser =>
  ({
    id,
    status: 'ACTIVE',
    lastUpdated: '2026-01-01T00:00:00.000Z',
    credentials: { provider: { type: 'OKTA' } },
    profile: {
      login: `${id}@example.com`,
      email: `${id}@example.com`,
      firstName: 'Fake',
      lastName: 'Person',
      department,
    },
  }) as OktaUser;

const CONTEXT_USER = makeUser('00uFAKE00000000000001', 'Sales');
const COMPARED_USER = makeUser('00uFAKE00000000000002', 'Support');

const attributes = (department: string): AttributeDescriptor[] => [
  {
    key: 'profile.department',
    name: 'department',
    label: 'Department',
    kind: 'custom',
    value: department,
    raw: department,
    isEmpty: false,
    property: writable,
  },
];

const NO_MEMBERSHIPS: readonly GroupMembership[] = [];

const options = (
  over: Partial<UseComparisonProfileEditOptions> = {},
): UseComparisonProfileEditOptions => ({
  contextUser: CONTEXT_USER,
  contextName: 'Ada Context',
  contextAttributes: attributes('Sales'),
  contextMemberships: NO_MEMBERSHIPS,
  comparedUser: COMPARED_USER,
  comparedName: 'Bo Compared',
  comparedAttributes: attributes('Support'),
  comparedMemberships: NO_MEMBERSHIPS,
  onComparedUserUpdated: vi.fn(),
  rules: { status: 'available', rules: [] },
  targetTabId: 1,
  enabled: true,
  ...over,
});

const render = (over: Partial<UseComparisonProfileEditOptions> = {}) =>
  renderHook((props: UseComparisonProfileEditOptions) => useComparisonProfileEdit(props), {
    initialProps: options(over),
  });

/** Enter edit mode on a column and draft a new value for `department`. */
const draft = (
  result: { current: ReturnType<typeof useComparisonProfileEdit> },
  key: 'context' | 'compared',
  value: string,
): void => {
  act(() => result.current[key].begin());
  act(() => result.current[key].cells.department?.onChange?.(value));
};

beforeEach(() => {
  vi.clearAllMocks();
  api.updateUserProfile.mockResolvedValue({ kind: 'saved', user: COMPARED_USER });
});

describe('useComparisonProfileEdit', () => {
  it('offers no editing on a column whose save nothing could publish', () => {
    const { result } = render();

    // No `onContextUserUpdated`: a save on the left column would leave every
    // other surface rendering values Okta no longer holds.
    expect(result.current.context.canEdit).toBe(false);
    expect(result.current.compared.canEdit).toBe(true);

    act(() => result.current.context.begin());
    expect(result.current.context.isEditing).toBe(false);
  });

  it('opens the left column once a host can publish the save', () => {
    const { result } = render({ onContextUserUpdated: vi.fn() });

    expect(result.current.context.canEdit).toBe(true);
    act(() => result.current.context.begin());
    expect(result.current.context.isEditing).toBe(true);
  });

  it('stays inert while the comparison is off screen (ADR-0018)', () => {
    const { result } = render({ enabled: false, onContextUserUpdated: vi.fn() });

    expect(result.current.compared.canEdit).toBe(false);
    act(() => result.current.compared.begin());
    expect(result.current.compared.isEditing).toBe(false);
  });

  it('keeps the two columns independent — a draft on one is not a draft on the other', () => {
    const { result } = render({ onContextUserUpdated: vi.fn() });

    draft(result, 'compared', 'Engineering');

    expect(result.current.compared.hasChanges).toBe(true);
    expect(result.current.context.isEditing).toBe(false);
    expect(result.current.context.hasChanges).toBe(false);

    act(() => result.current.compared.cancel());
    expect(result.current.compared.hasChanges).toBe(false);
  });

  it('arms one confirmation, tagged with the column and user it will write to', () => {
    const { result } = render();

    draft(result, 'compared', 'Engineering');
    act(() => result.current.compared.requestSave());

    expect(result.current.pendingSave?.side).toBe('compared');
    expect(result.current.pendingSave?.userName).toBe('Bo Compared');
    expect(result.current.pendingSave?.changes.map((change) => change.name)).toEqual([
      'department',
    ]);
  });

  it('refuses to arm a confirmation with nothing to write', () => {
    const { result } = render();

    act(() => result.current.compared.begin());
    act(() => result.current.compared.requestSave());

    expect(result.current.pendingSave).toBeNull();
  });

  it('keeps the confirmation on screen across its own write', async () => {
    let settle: (value: unknown) => void = () => {};
    api.updateUserProfile.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );

    const { result } = render();
    draft(result, 'compared', 'Engineering');
    act(() => result.current.compared.requestSave());

    act(() => result.current.pendingSave?.confirm());

    // `useProfileEdit` clears its own pendingSave before the request goes out, so
    // this is the moment a naively-bound modal would vanish mid-write.
    await waitFor(() => expect(result.current.pendingSave?.isSaving).toBe(true));
    expect(result.current.pendingSave?.changes).toHaveLength(1);

    await act(async () => {
      settle({ kind: 'saved', user: COMPARED_USER });
    });

    await waitFor(() => expect(result.current.pendingSave).toBeNull());
    expect(result.current.compared.isEditing).toBe(false);
    expect(result.current.compared.message).toBeUndefined();
  });

  it('holds a rejected write in the confirmation, with the reason and the draft intact', async () => {
    api.updateUserProfile.mockResolvedValue({ kind: 'failed', error: 'Okta said no.' });

    const { result } = render();
    draft(result, 'compared', 'Engineering');
    act(() => result.current.compared.requestSave());
    await act(async () => {
      result.current.pendingSave?.confirm();
    });

    // Re-armed rather than dismissed: the admin is one fix away from retrying,
    // and the list a retry would write is the one on screen.
    await waitFor(() => expect(result.current.pendingSave?.error).toBe('Okta said no.'));
    expect(result.current.compared.isEditing).toBe(true);
    expect(result.current.compared.hasChanges).toBe(true);
    // One message, in one place: the confirmation is carrying it, so the column
    // does not repeat it behind the modal.
    expect(result.current.compared.message).toBeUndefined();
  });

  it('reports an unconfirmed write as a warning on the column, not as a failure', async () => {
    api.updateUserProfile.mockResolvedValue({ kind: 'unknown' });

    const { result } = render();
    draft(result, 'compared', 'Engineering');
    act(() => result.current.compared.requestSave());
    await act(async () => {
      result.current.pendingSave?.confirm();
    });

    await waitFor(() => expect(result.current.pendingSave).toBeNull());
    // `warning`, never `danger` — the write may well have applied, and saying it
    // failed would be a different, wrong finding (ADR-0002 vocabulary).
    expect(result.current.compared.message?.type).toBe('warning');
    expect(result.current.compared.message?.text).toContain('Bo Compared');
    expect(result.current.compared.isEditing).toBe(false);
  });

  it('drops the outcome message when the column is edited again', async () => {
    api.updateUserProfile.mockResolvedValue({ kind: 'unknown' });

    const { result } = render();
    draft(result, 'compared', 'Engineering');
    act(() => result.current.compared.requestSave());
    await act(async () => {
      result.current.pendingSave?.confirm();
    });
    await waitFor(() => expect(result.current.compared.message).toBeDefined());

    act(() => result.current.compared.begin());
    expect(result.current.compared.message).toBeUndefined();
  });

  it('dismisses the confirmation without touching the draft', () => {
    const { result } = render();

    draft(result, 'compared', 'Engineering');
    act(() => result.current.compared.requestSave());
    act(() => result.current.pendingSave?.cancel());

    expect(result.current.pendingSave).toBeNull();
    expect(result.current.compared.isEditing).toBe(true);
    expect(result.current.compared.hasChanges).toBe(true);
  });
});
