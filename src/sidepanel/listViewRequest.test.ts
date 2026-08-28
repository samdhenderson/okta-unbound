/**
 * Unit tests for the cross-tab list-view request.
 *
 * `viewFor` is the whole module's load-bearing part: `App` hands every list tab
 * the same expression, and each tab must receive its own view or nothing. A
 * version that leaked another tab's view would apply a groups filter in the
 * apps tab, silently.
 */
import { describe, it, expect } from 'vitest';
import { viewFor, type ListViewRequest } from './listViewRequest';

describe('viewFor', () => {
  const groupsRequest: ListViewRequest = { tab: 'groups', view: 'empty' };

  it('hands a tab its own view', () => {
    expect(viewFor(groupsRequest, 'groups')).toBe('empty');
  });

  it('hands every other tab nothing', () => {
    expect(viewFor(groupsRequest, 'apps')).toBeNull();
    expect(viewFor(groupsRequest, 'rules')).toBeNull();
  });

  it('is null with no request pending', () => {
    expect(viewFor(null, 'groups')).toBeNull();
    expect(viewFor(undefined, 'rules')).toBeNull();
  });

  it('round-trips each tab’s views', () => {
    expect(viewFor({ tab: 'groups', view: 'no-rules' }, 'groups')).toBe('no-rules');
    expect(viewFor({ tab: 'apps', view: 'inactive' }, 'apps')).toBe('inactive');
    expect(viewFor({ tab: 'apps', view: 'pushes-nothing' }, 'apps')).toBe('pushes-nothing');
    expect(viewFor({ tab: 'rules', view: 'paused' }, 'rules')).toBe('paused');
  });
});
