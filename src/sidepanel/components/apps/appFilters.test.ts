/**
 * @module sidepanel/components/apps/appFilters.test
 * @description Unit tests for the Applications list's pure filter/sort helpers.
 */
import { describe, expect, it } from 'vitest';
import type { OktaAppListItem } from '../../../shared/schemas/okta';
import {
  appDisplayLabel,
  appStatusVariant,
  compareAppsBy,
  computeActiveAppFilterCount,
  filterAndSortApps,
  matchesAppSearch,
  matchesAppStatus,
  type AppFilterState,
} from './appFilters';

const app = (overrides: Partial<OktaAppListItem> & { id: string }): OktaAppListItem =>
  ({ ...overrides }) as OktaAppListItem;

const salesforce = app({
  id: '0oaFAKE0001',
  name: 'salesforce',
  label: 'Salesforce',
  status: 'ACTIVE',
  signOnMode: 'SAML_2_0',
  created: '2026-01-15T00:00:00.000Z',
});
const workday = app({
  id: '0oaFAKE0002',
  name: 'workday',
  label: 'Workday HR',
  status: 'INACTIVE',
  signOnMode: 'SAML_2_0',
  created: '2026-03-01T00:00:00.000Z',
});
const bookmark = app({
  id: '0oaFAKE0003',
  name: 'bookmark',
  status: 'ACTIVE',
  signOnMode: 'BOOKMARK',
});

const baseState: AppFilterState = {
  searchQuery: '',
  statusFilter: '',
  sortBy: 'label',
  sortDesc: false,
};

describe('appDisplayLabel', () => {
  it('prefers label, then name, then id', () => {
    expect(appDisplayLabel(salesforce)).toBe('Salesforce');
    expect(appDisplayLabel(bookmark)).toBe('bookmark');
    expect(appDisplayLabel(app({ id: '0oaFAKE0009' }))).toBe('0oaFAKE0009');
  });
});

describe('matchesAppSearch', () => {
  it('matches everything for an empty query', () => {
    expect(matchesAppSearch(salesforce, '   ')).toBe(true);
  });

  it('substring-matches label, name, and id case-insensitively', () => {
    expect(matchesAppSearch(salesforce, 'sales')).toBe(true);
    expect(matchesAppSearch(workday, 'WORKDAY')).toBe(true);
    expect(matchesAppSearch(workday, '0oafake0002')).toBe(true);
    expect(matchesAppSearch(workday, 'salesforce')).toBe(false);
  });

  it('treats a slash-wrapped query as a regex', () => {
    expect(matchesAppSearch(salesforce, '/^sales/i')).toBe(true);
    expect(matchesAppSearch(workday, '/^sales/i')).toBe(false);
  });

  it('falls back to substring matching for an invalid regex', () => {
    expect(matchesAppSearch(salesforce, '/[unclosed/')).toBe(false);
  });
});

describe('matchesAppStatus', () => {
  it('matches everything when no bucket is selected', () => {
    expect(matchesAppStatus(undefined, '')).toBe(true);
    expect(matchesAppStatus('INACTIVE', '')).toBe(true);
  });

  it('partitions active from everything else, including a missing status', () => {
    expect(matchesAppStatus('ACTIVE', 'ACTIVE')).toBe(true);
    expect(matchesAppStatus('INACTIVE', 'ACTIVE')).toBe(false);
    expect(matchesAppStatus('INACTIVE', 'INACTIVE')).toBe(true);
    expect(matchesAppStatus(undefined, 'INACTIVE')).toBe(true);
    expect(matchesAppStatus(undefined, 'ACTIVE')).toBe(false);
  });
});

describe('compareAppsBy', () => {
  it('compares by display label', () => {
    expect(compareAppsBy(salesforce, workday, 'label')).toBeLessThan(0);
  });

  it('compares by status', () => {
    expect(compareAppsBy(salesforce, workday, 'status')).toBeLessThan(0);
  });

  it('sorts a missing created date last in ascending order', () => {
    expect(compareAppsBy(bookmark, salesforce, 'created')).toBe(1);
    expect(compareAppsBy(salesforce, bookmark, 'created')).toBe(-1);
    expect(compareAppsBy(salesforce, workday, 'created')).toBeLessThan(0);
  });
});

describe('filterAndSortApps', () => {
  const apps = [workday, bookmark, salesforce];

  it('does not mutate the input array', () => {
    const input = [...apps];
    filterAndSortApps(input, baseState);
    expect(input).toEqual(apps);
  });

  it('sorts by label ascending by default', () => {
    expect(filterAndSortApps(apps, baseState).map((a) => a.id)).toEqual([
      bookmark.id,
      salesforce.id,
      workday.id,
    ]);
  });

  it('honours the descending flag', () => {
    expect(filterAndSortApps(apps, { ...baseState, sortDesc: true }).map((a) => a.id)).toEqual([
      workday.id,
      salesforce.id,
      bookmark.id,
    ]);
  });

  it('applies search and status conjunctively', () => {
    const result = filterAndSortApps(apps, {
      ...baseState,
      searchQuery: 'a',
      statusFilter: 'ACTIVE',
    });
    expect(result.map((a) => a.id)).toEqual([bookmark.id, salesforce.id]);
  });

  it('filters to the inactive bucket', () => {
    expect(
      filterAndSortApps(apps, { ...baseState, statusFilter: 'INACTIVE' }).map((a) => a.id),
    ).toEqual([workday.id]);
  });
});

describe('appStatusVariant', () => {
  it('maps statuses to badge variants using the danger vocabulary', () => {
    expect(appStatusVariant('ACTIVE')).toBe('success');
    expect(appStatusVariant('DELETED')).toBe('danger');
    expect(appStatusVariant('INACTIVE')).toBe('neutral');
    expect(appStatusVariant(undefined)).toBe('neutral');
  });
});

describe('computeActiveAppFilterCount', () => {
  it('counts only the status bucket', () => {
    expect(computeActiveAppFilterCount({ statusFilter: '' })).toBe(0);
    expect(computeActiveAppFilterCount({ statusFilter: 'ACTIVE' })).toBe(1);
  });
});
