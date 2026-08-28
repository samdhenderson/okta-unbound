/**
 * Unit tests for the org-snapshot card's honesty rules.
 *
 * The subject is **the zero trap**. `rows.length === 0` means three different
 * things — a genuinely empty org, a read that has not happened, and a read that
 * failed — and only the first may be shown as "0". Getting this wrong renders a
 * healthy org an empty inventory, which is the worst thing this card could do,
 * so every branch gets a case.
 */
import { describe, it, expect } from 'vitest';
import { figureStatus, buildFigure, oldestWalkAt, type FigureSource } from './orgFigures';

const WALK_AT = 1_800_000_000_000;

/** A finished, populated read — the only shape that produces a number. */
const source = (over: Partial<FigureSource> = {}): FigureSource => ({
  isReading: false,
  complete: true,
  lastFullWalkAt: WALK_AT,
  count: 42,
  error: null,
  ...over,
});

describe('figureStatus', () => {
  it('is ok only when a walk actually finished', () => {
    expect(figureStatus(source())).toBe('ok');
  });

  it('is reading while the first read is in flight', () => {
    // A skeleton, never a `0`: the count is unknown, not zero.
    expect(figureStatus(source({ isReading: true, count: 0 }))).toBe('reading');
  });

  it('is partial when rows exist but the walk did not finish', () => {
    expect(figureStatus(source({ complete: false }))).toBe('partial');
  });

  it('is unavailable when nothing has ever been read', () => {
    expect(figureStatus(source({ complete: false, lastFullWalkAt: null, count: 0 }))).toBe(
      'unavailable',
    );
  });

  it('does not trust `complete` on its own', () => {
    // A collection flagged complete with no walk stamp behind it has not been
    // walked; believing the flag alone would reintroduce the zero trap through
    // a different door.
    expect(figureStatus(source({ lastFullWalkAt: null, count: 0 }))).toBe('unavailable');
  });

  it('reports a genuinely empty org as ok, so a real zero is still an answer', () => {
    // The mirror-image error: hiding a loaded zero is as wrong as inventing one.
    expect(figureStatus(source({ count: 0 }))).toBe('ok');
  });
});

describe('buildFigure', () => {
  it('renders the count when the walk finished', () => {
    expect(buildFigure('groups', 'Groups', 'users', source())).toMatchObject({
      status: 'ok',
      value: 42,
      note: undefined,
    });
  });

  it('shows a real zero for an empty org', () => {
    expect(buildFigure('groups', 'Groups', 'users', source({ count: 0 }))).toMatchObject({
      status: 'ok',
      value: 0,
    });
  });

  it('withholds the number entirely while reading', () => {
    expect(buildFigure('groups', 'Groups', 'users', source({ isReading: true })).value).toBeNull();
  });

  it('withholds the number entirely when nothing was read', () => {
    const figure = buildFigure(
      'groups',
      'Groups',
      'users',
      source({ complete: false, lastFullWalkAt: null, count: 0 }),
    );
    expect(figure.value).toBeNull();
    expect(figure.note).toBe('Groups have not been read yet.');
  });

  it('marks a partial count as a floor rather than a total (ADR-0040 §7)', () => {
    const figure = buildFigure('groups', 'Groups', 'users', source({ complete: false }));
    expect(figure).toMatchObject({ status: 'partial', value: 42 });
    expect(figure.note).toMatch(/At least/);
  });

  it('says a read failed without claiming why', () => {
    // The design specifies a literal 403 line. Status is dropped across four
    // layers, so claiming a permission problem on what may have been a dropped
    // connection would be a guess presented as a fact.
    const figure = buildFigure(
      'rules',
      'Rules',
      'bolt',
      source({ complete: false, lastFullWalkAt: null, count: 0, error: 'Failed to load' }),
    );
    expect(figure.note).toBe('The last read of rules did not finish.');
    expect(figure.note).not.toMatch(/403|permission|admin/i);
  });

  it('counts a subset when one is passed, keeping the source collection’s status', () => {
    // "Rules paused" is a filter over the rules collection, so it inherits that
    // collection's trustworthiness rather than being judged on its own count.
    const figure = buildFigure('paused', 'Rules paused', 'pause', source({ count: 40 }), 3);
    expect(figure).toMatchObject({ status: 'ok', value: 3 });
  });
});

describe('oldestWalkAt', () => {
  it('quotes the oldest walk, not the newest', () => {
    // One stamp is shown for four figures; the newest would date the whole card
    // by its most recently refreshed corner.
    expect(oldestWalkAt([source(), source({ lastFullWalkAt: WALK_AT - 5000 }), source()])).toBe(
      WALK_AT - 5000,
    );
  });

  it('has no age at all when any collection has never been walked', () => {
    expect(oldestWalkAt([source(), source({ lastFullWalkAt: null })])).toBeNull();
  });
});
