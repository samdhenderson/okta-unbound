import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDate, getRelativeTime } from './dateFormat';

describe('formatDate', () => {
  it('returns "Never" for empty input', () => {
    expect(formatDate(null)).toBe('Never');
    expect(formatDate(undefined)).toBe('Never');
    expect(formatDate('')).toBe('Never');
  });

  it('formats a valid ISO date to a human string', () => {
    const out = formatDate('2026-03-05T14:30:00Z');
    expect(out).toContain('2026');
    expect(out).toMatch(/Mar/);
  });
});

describe('getRelativeTime', () => {
  afterEach(() => vi.useRealTimers());

  it('returns null for empty input', () => {
    expect(getRelativeTime(null)).toBeNull();
    expect(getRelativeTime(undefined)).toBeNull();
  });

  it('describes relative distances from a fixed now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T12:00:00Z'));
    expect(getRelativeTime('2026-07-14T09:00:00Z')).toBe('today');
    expect(getRelativeTime('2026-07-13T09:00:00Z')).toBe('yesterday');
    expect(getRelativeTime('2026-07-10T12:00:00Z')).toBe('4 days ago');
    expect(getRelativeTime('2026-06-28T12:00:00Z')).toBe('2 weeks ago');
    expect(getRelativeTime('2026-05-14T12:00:00Z')).toBe('2 months ago');
  });
});
