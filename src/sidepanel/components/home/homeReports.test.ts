/**
 * Unit tests for the report descriptors.
 *
 * One rule carries the whole subject: **a report that cannot state a number
 * names nobody.** The findings were computed from whatever rows happened to be
 * on disk, so publishing them beside an em dash would present a half-read
 * collection's leftovers as the answer — ADR-0040 §7's defect, spelled with
 * names instead of a count.
 */
import { describe, it, expect } from 'vitest';
import { buildReport, REPORT_PREVIEW_LIMIT } from './homeReports';
import type { FigureSource, NamedSource } from './orgFigures';

const WALK_AT = 1_800_000_000_000;

const source = (over: Partial<FigureSource> = {}): FigureSource => ({
  isReading: false,
  complete: true,
  lastFullWalkAt: WALK_AT,
  count: 214,
  error: null,
  ...over,
});

const named = (over: Partial<FigureSource> = {}, noun = 'groups'): NamedSource => ({
  source: source(over),
  noun,
});

const finding = (n: number) => ({ id: `00gFAKE${n}`, name: `Group ${n}`, detail: 'No members' });

const base = {
  key: 'group-cleanup',
  label: 'Empty groups nothing fills',
  counted: named(),
  caveat: 'What this cannot see.',
};

describe('buildReport', () => {
  it('counts its own findings and says what they are out of', () => {
    const report = buildReport({ ...base, findings: [finding(1), finding(2)] });
    expect(report).toMatchObject({
      key: 'group-cleanup',
      status: 'ok',
      value: 2,
      note: 'of 214 groups',
      caveat: 'What this cannot see.',
    });
    expect(report.findings).toHaveLength(2);
  });

  it('reports a genuine none as a real zero', () => {
    // Not the same as "unknown", and the card renders the two differently: one
    // is good news, the other is a gap.
    expect(buildReport({ ...base, findings: [] })).toMatchObject({ status: 'ok', value: 0 });
  });

  it('names nobody when a gate was never walked', () => {
    const report = buildReport({
      ...base,
      gates: [named({ complete: false, lastFullWalkAt: null, count: 0 }, 'group rules')],
      findings: [finding(1), finding(2)],
    });
    expect(report.value).toBeNull();
    expect(report.findings).toEqual([]);
    expect(report.note).toBe('Needs group rules, which have not been read.');
  });

  it('names nobody while a collection is still being read', () => {
    const report = buildReport({
      ...base,
      counted: named({ isReading: true }),
      findings: [finding(1)],
    });
    expect(report).toMatchObject({ status: 'reading', value: null, note: undefined });
    expect(report.findings).toEqual([]);
  });

  it('still names what it found when only a floor fell short', () => {
    // A short population is a floor, not a wrong answer: the rows that never
    // arrived can only add findings, so the ones already found are real.
    const report = buildReport({
      ...base,
      floors: [named({ complete: false }, 'app group assignments')],
      findings: [finding(1)],
    });
    expect(report).toMatchObject({ status: 'partial', value: 1 });
    expect(report.findings).toHaveLength(1);
    expect(report.note).toBe('At least — the last read of app group assignments did not finish.');
  });

  it('caps the preview but keeps the true count, so the row can say it is capped', () => {
    const findings = Array.from({ length: REPORT_PREVIEW_LIMIT + 7 }, (_, i) => finding(i));
    const report = buildReport({ ...base, findings });
    expect(report.value).toBe(REPORT_PREVIEW_LIMIT + 7);
    expect(report.findings).toHaveLength(REPORT_PREVIEW_LIMIT);
  });
});
