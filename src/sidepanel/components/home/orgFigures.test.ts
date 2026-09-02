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
import {
  buildBox,
  buildFigure,
  buildSubCount,
  figureStatus,
  oldestWalkAt,
  subCountStatus,
  type FigureSource,
} from './orgFigures';

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

  it('names the permission problem when the failure status says so (D-068)', () => {
    // A 403 (or 401) is distinguishable from a 429 or a dropped connection now
    // that the walk's HTTP status survives into `WalkOutcome` — this is the
    // curtailed-for-a-known-reason case the generic "did not finish" copy
    // above still covers for every other status.
    const figure = buildFigure(
      'rules',
      'Rules',
      'bolt',
      source({
        complete: false,
        lastFullWalkAt: null,
        count: 0,
        error: 'Forbidden',
        status: 403,
      }),
    );
    expect(figure.note).toBe('You are not allowed to read rules.');
  });

  it('does not claim a permission problem for a non-403/401 status', () => {
    // A 429 stopped the walk too, but that is not evidence of a permissions
    // problem — reporting it as one would be a stronger, wrong claim.
    const figure = buildFigure(
      'rules',
      'Rules',
      'bolt',
      source({
        complete: false,
        lastFullWalkAt: null,
        count: 0,
        error: 'Too Many Requests',
        status: 429,
      }),
    );
    expect(figure.note).toBe('The last read of rules did not finish.');
  });

  it('counts a subset when one is passed, keeping the source collection’s status', () => {
    // "Rules paused" is a filter over the rules collection, so it inherits that
    // collection's trustworthiness rather than being judged on its own count.
    const figure = buildFigure('paused', 'Rules paused', 'pause', source({ count: 40 }), 3);
    expect(figure).toMatchObject({ status: 'ok', value: 3 });
  });
});

/** A named collection, for the sub-count builders. */
const named = (over: Partial<FigureSource> = {}, noun = 'groups') => ({
  source: source(over),
  noun,
});

describe('subCountStatus', () => {
  it('inherits the counted collection when nothing gates it', () => {
    expect(subCountStatus(source(), [])).toBe('ok');
    expect(subCountStatus(source({ complete: false }), [])).toBe('partial');
  });

  it('lets a partial COUNTED collection through as a floor', () => {
    // "At least 31 empty groups" out of an interrupted group walk is true: the
    // pages that never arrived can only add more.
    expect(subCountStatus(source({ complete: false }), [source()])).toBe('partial');
  });

  it('suppresses the count when a GATE walk did not finish', () => {
    // The asymmetry, and the reason this function exists. "Groups no rule feeds"
    // is computed by subtracting the rules that were read, so a rule list
    // missing half its pages does not under-report — it reports every group
    // those missing rules fed as unfed. That is a wrong number, not a floor.
    expect(subCountStatus(source(), [source({ complete: false })])).toBe('unavailable');
    expect(
      subCountStatus(source(), [source({ complete: false, lastFullWalkAt: null, count: 0 })]),
    ).toBe('unavailable');
  });

  it('reads as reading while either side is still loading', () => {
    expect(subCountStatus(source({ isReading: true }), [source()])).toBe('reading');
    expect(subCountStatus(source(), [source({ isReading: true })])).toBe('reading');
  });

  it('treats a FLOOR like the counted collection, not like a gate', () => {
    // The third role, and the one the reports need. "App access no rule
    // maintains" draws its population out of the app-group assignments, so an
    // unfinished assignment walk shortens the answer without corrupting it —
    // the same floor an unfinished groups walk produces, and emphatically not
    // the suppression a gate would produce.
    expect(subCountStatus(source(), [source()], [source({ complete: false })])).toBe('partial');
    expect(subCountStatus(source(), [source()], [source()])).toBe('ok');
  });

  it('still suppresses when a floor was never read at all', () => {
    // A floor may be short. It may not be absent: with nothing read there is no
    // population to have drawn from, so the count is not a floor, it is nothing.
    expect(
      subCountStatus(source(), [], [source({ complete: false, lastFullWalkAt: null, count: 0 })]),
    ).toBe('unavailable');
  });

  it('reads as reading while a floor is still loading', () => {
    expect(subCountStatus(source(), [], [source({ isReading: true })])).toBe('reading');
  });
});

describe('buildSubCount', () => {
  const request = { tab: 'groups', view: 'empty' } as const;
  const base = {
    key: 'groups-empty',
    label: 'Groups with no members',
    counted: named({ count: 214 }),
    count: 31,
    request,
  };

  it('carries its number, its destination and what it is out of', () => {
    expect(buildSubCount(base)).toMatchObject({
      status: 'ok',
      value: 31,
      request,
      note: 'of 214 groups',
    });
  });

  it('marks a floor when the counted walk did not finish', () => {
    const floor = buildSubCount({ ...base, counted: named({ count: 214, complete: false }) });
    expect(floor).toMatchObject({ status: 'partial', value: 31 });
    expect(floor.note).toBe('At least — the last read of groups did not finish.');
  });

  it('withholds the number rather than shipping a wrong one, and names the gap', () => {
    // `value: null` is what makes the card render a row with an em dash instead
    // of a control — a link into a list that would disagree with the figure is
    // the dead control ADR-0039 bans, wearing a different hat. And the note
    // names the collection that is missing: "needs group rules" points
    // somewhere different from "groups have not been read".
    const suppressed = buildSubCount({
      ...base,
      key: 'groups-unruled',
      label: 'Groups no rule fills',
      gates: [named({ complete: false }, 'group rules')],
      count: 214,
      request: { tab: 'groups', view: 'no-rules' },
    });
    expect(suppressed.value).toBeNull();
    expect(suppressed.note).toBe('Needs group rules, which have not been read.');
  });

  it('names its own collection when that is what is missing', () => {
    const suppressed = buildSubCount({
      ...base,
      counted: named({ complete: false, lastFullWalkAt: null, count: 0 }),
    });
    expect(suppressed.value).toBeNull();
    expect(suppressed.note).toBe('Groups have not been read yet.');
  });

  it('shows no note while reading — the skeleton is the message', () => {
    const reading = buildSubCount({ ...base, counted: named({ isReading: true }) });
    expect(reading).toMatchObject({ status: 'reading', value: null, note: undefined });
  });

  it('names the collection that actually fell short, which may be a floor', () => {
    // With a floor in play the short collection is not always the counted one,
    // and quoting the wrong name would send a reader to refresh something that
    // is already current.
    const floor = buildSubCount({
      ...base,
      floors: [named({ complete: false }, 'app group assignments')],
    });
    expect(floor).toMatchObject({ status: 'partial', value: 31 });
    expect(floor.note).toBe('At least — the last read of app group assignments did not finish.');
  });
});

describe('buildBox', () => {
  it('pairs a total with its tab, its noun and its findings', () => {
    const box = buildBox(buildFigure('groups', 'Groups', 'users', source()), 'groups', 'groups', [
      buildSubCount({
        key: 'groups-empty',
        label: 'Groups with no members',
        counted: named(),
        count: 31,
        request: { tab: 'groups', view: 'empty' },
      }),
    ]);
    expect(box).toMatchObject({ key: 'groups', tab: 'groups', noun: 'groups', value: 42 });
    expect(box.subCounts.map((s) => s.value)).toEqual([31]);
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
