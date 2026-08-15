/**
 * The admin-roles read (`GET /api/v1/groups/{id}/roles`) commonly `403`s for a
 * non-super-admin session. This pins that {@link useGroupAccessGrants} degrades
 * that axis to `rolesStatus: 'unavailable'` rather than failing the whole load —
 * the apps axis, which answers the same "what does membership grant" question
 * from the other side, must still resolve normally alongside it. It also pins
 * the honest counterpart: a genuinely empty (but *readable*) roles list reports
 * `'available'`, never `'unavailable'` — the two must not be conflated.
 *
 * Fixtures use only fake placeholders (`00gFAKE…`, `0oaFAKE…`) per CLAUDE.md.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGroupAccessGrants } from './useGroupAccessGrants';

const runtimeSendMessage = chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;

const GROUP_ID = '00gFAKEGROUP1';
const TAB_ID = 1;

/** A schema-valid app-list row. */
function makeApp(id: string, label: string) {
  return { id, label };
}

/** Route `scheduleApiRequest` traffic to per-endpoint canned responses. */
function installHarness(handlers: {
  apps: () => { success: boolean; data?: unknown; status?: number; error?: string };
  roles: () => { success: boolean; data?: unknown; status?: number; error?: string };
}) {
  runtimeSendMessage.mockReset();
  runtimeSendMessage.mockImplementation(async (message: { action?: string; endpoint?: string }) => {
    if (message?.action !== 'scheduleApiRequest') return { success: true };
    const endpoint = message.endpoint ?? '';
    if (endpoint.startsWith(`/api/v1/groups/${GROUP_ID}/apps`)) {
      return { headers: {}, ...handlers.apps() };
    }
    if (endpoint.startsWith(`/api/v1/groups/${GROUP_ID}/roles`)) {
      return { headers: {}, ...handlers.roles() };
    }
    throw new Error(`Unrouted test endpoint: ${endpoint}`);
  });
}

beforeEach(() => {
  runtimeSendMessage.mockReset();
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

describe('useGroupAccessGrants', () => {
  it("degrades the roles axis to 'unavailable' on a 403 without failing the apps axis", async () => {
    installHarness({
      apps: () => ({ success: true, data: [makeApp('0oaFAKEAPP1', 'Salesforce')] }),
      roles: () => ({ success: false, status: 403, error: 'Forbidden' }),
    });

    const { result } = renderHook(() => useGroupAccessGrants(GROUP_ID, TAB_ID));

    await waitFor(() => expect(result.current.appsStatus).toBe('done'));
    await waitFor(() => expect(result.current.rolesStatus).toBe('unavailable'));

    expect(result.current.apps).toEqual([{ id: '0oaFAKEAPP1', label: 'Salesforce' }]);
    expect(result.current.roles).toEqual([]);
    expect(result.current.appsError).toBeNull();
  });

  it("reports a genuinely empty roles list as 'available', never 'unavailable'", async () => {
    installHarness({
      apps: () => ({ success: true, data: [] }),
      roles: () => ({ success: true, data: [] }),
    });

    const { result } = renderHook(() => useGroupAccessGrants(GROUP_ID, TAB_ID));

    await waitFor(() => expect(result.current.appsStatus).toBe('done'));
    await waitFor(() => expect(result.current.rolesStatus).toBe('available'));

    expect(result.current.roles).toEqual([]);
  });

  it('surfaces a real apps-read failure as an error, unlike a roles 403', async () => {
    installHarness({
      apps: () => ({ success: false, status: 500, error: 'Internal error' }),
      roles: () => ({ success: true, data: [] }),
    });

    const { result } = renderHook(() => useGroupAccessGrants(GROUP_ID, TAB_ID));

    await waitFor(() => expect(result.current.appsStatus).toBe('error'));
    expect(result.current.appsError).toBe('Internal error');
  });
});
