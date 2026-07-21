/**
 * @module sidepanel/export/descriptors/appUsers.test
 * @description Unit tests for the App Users export descriptor — pins its
 * `search-to-select` context (App label, endpoint shape) and the local app-user
 * schema/accessor behavior. Pure object assertions; no network or engine.
 */

import { describe, it, expect } from 'vitest';
import appUsersDescriptor, { appUsersDescriptor as named } from './appUsers';

// Obviously-fake app id — never a real Okta org identifier.
const FAKE_APP_ID = '0oaFAKE1';

describe('appUsersDescriptor', () => {
  it('is exported both as default and named binding', () => {
    expect(appUsersDescriptor).toBe(named);
  });

  it('declares stable registry identity and icon', () => {
    expect(appUsersDescriptor.id).toBe('app-users');
    expect(appUsersDescriptor.displayName).toBe('App Users');
    expect(appUsersDescriptor.icon).toBe('users');
  });

  it('uses a search-to-select context labelled App', () => {
    expect(appUsersDescriptor.context.kind).toBe('search-to-select');
    if (appUsersDescriptor.context.kind !== 'search-to-select') {
      throw new Error('expected search-to-select context');
    }
    expect(appUsersDescriptor.context.label).toBe('App');
    expect(appUsersDescriptor.context.placeholder).toBe('Search apps by name…');
    expect(appUsersDescriptor.context.endpoint(FAKE_APP_ID)).toBe(
      `/api/v1/apps/${FAKE_APP_ID}/users`,
    );
  });

  it('deep-links each row as a user via the id column', () => {
    expect(appUsersDescriptor.filter).toEqual({ kind: 'none' });
    expect(appUsersDescriptor.linkify).toEqual({ entityType: 'user', idColumnId: 'id' });
  });

  it('validates an app-user row carrying embedded credentials and surfaces userName', () => {
    const row = {
      id: '00uFAKE1',
      status: 'ACTIVE',
      scope: 'USER',
      credentials: { userName: 'user@example.com' },
    };

    // `schema` is the descriptor's local lenient app-user schema.
    const parsed = appUsersDescriptor.schema.parse(row);
    expect(parsed.credentials.userName).toBe('user@example.com');

    const userNameColumn = appUsersDescriptor.columnCatalog.find((c) => c.id === 'userName');
    expect(userNameColumn).toBeDefined();
    expect(userNameColumn?.accessor(row)).toBe('user@example.com');
  });
});
