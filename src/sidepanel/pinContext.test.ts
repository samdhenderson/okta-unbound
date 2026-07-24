/**
 * @module sidepanel/pinContext.test
 * @description Unit tests for the pin-aware tab-context resolver.
 */
import { describe, it, expect } from 'vitest';
import { deriveTabContext, type PinnedContext, type LiveTabContext } from './pinContext';

const live: LiveTabContext = {
  targetTabId: 7,
  groupInfo: { groupId: '00gLIVE', groupName: 'Live Group' },
  oktaOrigin: 'https://live.okta.com',
};

describe('deriveTabContext', () => {
  it('follows the live context when nothing is pinned', () => {
    expect(deriveTabContext(null, live)).toEqual({
      targetTabId: 7,
      currentGroupId: '00gLIVE',
      oktaOrigin: 'https://live.okta.com',
    });
  });

  it('follows a pinned group snapshot instead of the live tab', () => {
    const pinned: PinnedContext = {
      pageType: 'group',
      groupInfo: { groupId: '00gPINNED', groupName: 'Pinned Group' },
      userInfo: null,
      targetTabId: 3,
      oktaOrigin: 'https://pinned.okta.com',
    };
    expect(deriveTabContext(pinned, live)).toEqual({
      targetTabId: 3,
      currentGroupId: '00gPINNED',
      oktaOrigin: 'https://pinned.okta.com',
    });
  });

  it('yields no current group for a pinned user (only the tab + origin carry over)', () => {
    const pinned: PinnedContext = {
      pageType: 'user',
      groupInfo: null,
      userInfo: { userId: '00uPINNED', userName: 'Pat' },
      targetTabId: 4,
      oktaOrigin: 'https://pinned.okta.com',
    };
    expect(deriveTabContext(pinned, live)).toEqual({
      targetTabId: 4,
      currentGroupId: undefined,
      oktaOrigin: 'https://pinned.okta.com',
    });
  });

  it('passes through a null live tab id when unpinned and disconnected', () => {
    expect(
      deriveTabContext(null, { targetTabId: null, groupInfo: null, oktaOrigin: null }),
    ).toEqual({ targetTabId: null, currentGroupId: undefined, oktaOrigin: null });
  });
});
