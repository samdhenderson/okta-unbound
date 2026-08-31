import { describe, it, expect } from 'vitest';
import {
  pagesFor,
  walkEstimate,
  openingWalkEstimate,
  refinedWalkEstimate,
  fanOutEstimate,
  atLeastFanOutEstimate,
} from './planEstimate';
import { OKTA_PAGE_SIZE } from '../utils/oktaPagination';

describe('pagesFor', () => {
  it.each([
    [1, 1],
    [199, 1],
    [OKTA_PAGE_SIZE, 1],
    [OKTA_PAGE_SIZE + 1, 2],
    [OKTA_PAGE_SIZE * 2, 2],
    [OKTA_PAGE_SIZE * 2 + 1, 3],
    [10_000, 50],
  ])('%i items costs %i pages', (items, pages) => {
    expect(pagesFor(items)).toBe(pages);
  });

  it('costs one request for an empty collection', () => {
    // The walk has to ask before it can learn there is nothing there. An
    // estimate of 0 would show a plan that predicted nothing and then spent one.
    expect(pagesFor(0)).toBe(1);
  });

  it('costs one request for a nonsense total rather than zero or NaN', () => {
    expect(pagesFor(-5)).toBe(1);
    expect(pagesFor(Number.NaN)).toBe(1);
    expect(pagesFor(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('walkEstimate', () => {
  it('is exact when the total is known', () => {
    expect(walkEstimate(450)).toEqual({ kind: 'exact', requests: 3 });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['NaN', Number.NaN],
  ])('is unknown, not a fabricated page count, for %s', (_label, total) => {
    // The rule the whole module exists for: no estimator invents a number.
    expect(walkEstimate(total)).toEqual({ kind: 'unknown' });
  });
});

describe('walk refinement', () => {
  it('opens at a floor of one page', () => {
    expect(openingWalkEstimate()).toEqual({ kind: 'atLeast', requests: 1 });
  });

  it('raises the floor while more pages are promised', () => {
    expect(refinedWalkEstimate(3, true)).toEqual({ kind: 'atLeast', requests: 4 });
  });

  it('settles the floor into a fact when the walk ends', () => {
    expect(refinedWalkEstimate(3, false)).toEqual({ kind: 'exact', requests: 3 });
  });

  it('never reports fewer than the one page a walk always costs', () => {
    expect(refinedWalkEstimate(0, false)).toEqual({ kind: 'exact', requests: 1 });
  });
});

describe('fan-out estimates', () => {
  it('is exact — the item list is in hand', () => {
    expect(fanOutEstimate(40)).toEqual({ kind: 'exact', requests: 40 });
  });

  it('multiplies by the per-item request count', () => {
    expect(fanOutEstimate(12, 2)).toEqual({ kind: 'exact', requests: 24 });
  });

  it('treats a zero-per-item count as one, since an item cannot cost nothing', () => {
    expect(fanOutEstimate(5, 0)).toEqual({ kind: 'exact', requests: 5 });
  });

  it('is zero for an empty list — unlike a walk, there is nothing to ask about', () => {
    expect(fanOutEstimate(0)).toEqual({ kind: 'exact', requests: 0 });
  });

  it('is unknown for a nonsense item count', () => {
    expect(fanOutEstimate(Number.NaN)).toEqual({ kind: 'unknown' });
    expect(fanOutEstimate(-3)).toEqual({ kind: 'unknown' });
  });

  it('becomes a floor when each item paginates', () => {
    // Same arithmetic, different claim: a fan-out over a paginating worker knows
    // its minimum exactly and its total not at all.
    expect(atLeastFanOutEstimate(40)).toEqual({ kind: 'atLeast', requests: 40 });
  });

  it('stays unknown when the item count is unusable', () => {
    expect(atLeastFanOutEstimate(Number.NaN)).toEqual({ kind: 'unknown' });
  });
});
