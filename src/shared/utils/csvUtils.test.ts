/**
 * Tests for csvUtils — the security-critical CSV builders used by every export.
 * These pin RFC-4180 quoting and the spreadsheet-formula-injection guard
 * (CLAUDE.md: "Escape all export output"), plus the date/filename helpers.
 * Date-dependent helpers use fake timers so `new Date()` is deterministic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  escapeCSV,
  formatDateForCSV,
  generateCSV,
  sanitizeFilename,
  getDateForFilename,
  downloadCSV,
} from './csvUtils';

describe('escapeCSV', () => {
  it('returns an empty string for null', () => {
    expect(escapeCSV(null)).toBe('');
  });

  it('returns an empty string for undefined', () => {
    expect(escapeCSV(undefined)).toBe('');
  });

  it('passes a plain string through unchanged', () => {
    expect(escapeCSV('hello')).toBe('hello');
  });

  it('preserves an empty string (distinct from null) as empty', () => {
    expect(escapeCSV('')).toBe('');
  });

  it('quotes a value containing a comma', () => {
    expect(escapeCSV('a,b')).toBe('"a,b"');
  });

  it('quotes a value containing a newline', () => {
    expect(escapeCSV('line1\nline2')).toBe('"line1\nline2"');
  });

  it('doubles embedded quotes and wraps the field', () => {
    expect(escapeCSV('he "x"')).toBe('"he ""x"""');
  });

  it('quotes a value that contains only a double quote', () => {
    expect(escapeCSV('"')).toBe('""""');
  });

  describe('formula-injection guard', () => {
    it('prefixes a leading = with a single quote', () => {
      expect(escapeCSV('=SUM(A1)')).toBe("'=SUM(A1)");
    });

    it('prefixes a leading +', () => {
      expect(escapeCSV('+1')).toBe("'+1");
    });

    it('prefixes a leading -', () => {
      expect(escapeCSV('-cmd')).toBe("'-cmd");
    });

    it('prefixes a leading @', () => {
      expect(escapeCSV('@ref')).toBe("'@ref");
    });

    it('prefixes a leading tab', () => {
      expect(escapeCSV('\tvalue')).toBe("'\tvalue");
    });

    it('prefixes a leading carriage return', () => {
      expect(escapeCSV('\rvalue')).toBe("'\rvalue");
    });

    it('does not prefix a formula char that is not leading', () => {
      expect(escapeCSV('a=b')).toBe('a=b');
    });

    it('both neutralizes the formula AND quotes when a comma is present', () => {
      // Leading '=' → prefixed to '=..., then the comma forces RFC-4180 quoting.
      expect(escapeCSV('=A1,B2')).toBe(`"'=A1,B2"`);
    });

    it('does NOT prefix a negative number, keeping numeric cells numeric', () => {
      // typeof value is 'number', so the string-only guard is skipped.
      expect(escapeCSV(-5)).toBe('-5');
    });
  });

  describe('non-string primitives', () => {
    it('stringifies a number', () => {
      expect(escapeCSV(42)).toBe('42');
    });

    it('stringifies a boolean', () => {
      expect(escapeCSV(true)).toBe('true');
      expect(escapeCSV(false)).toBe('false');
    });
  });
});

describe('formatDateForCSV', () => {
  it('returns N/A for null', () => {
    expect(formatDateForCSV(null)).toBe('N/A');
  });

  it('returns N/A for undefined', () => {
    expect(formatDateForCSV(undefined)).toBe('N/A');
  });

  it('returns N/A for an empty string', () => {
    expect(formatDateForCSV('')).toBe('N/A');
  });

  it('returns N/A for an unparseable date string', () => {
    expect(formatDateForCSV('not-a-date')).toBe('N/A');
  });

  it('formats an ISO date string to YYYY-MM-DD', () => {
    expect(formatDateForCSV('2026-03-05T14:30:00Z')).toBe('2026-03-05');
  });

  it('formats a Date instance to YYYY-MM-DD', () => {
    expect(formatDateForCSV(new Date('2026-01-15T00:00:00Z'))).toBe('2026-01-15');
  });

  it('returns N/A for an invalid Date instance', () => {
    expect(formatDateForCSV(new Date('invalid'))).toBe('N/A');
  });
});

describe('generateCSV', () => {
  it('escapes every header and cell and joins rows with newlines', () => {
    const csv = generateCSV(
      ['Name', 'Note'],
      [
        ['Ada', 'plain'],
        ['Grace', 'has,comma'],
      ],
    );
    expect(csv).toBe('Name,Note\nAda,plain\nGrace,"has,comma"');
  });

  it('produces a header-only document when there are no rows', () => {
    expect(generateCSV(['A', 'B'], [])).toBe('A,B');
  });

  it('renders nullish cells as empty fields', () => {
    expect(generateCSV(['A', 'B'], [[null, undefined]])).toBe('A,B\n,');
  });

  it('neutralizes a formula in a data cell', () => {
    expect(generateCSV(['Val'], [['=EVIL()']])).toBe("Val\n'=EVIL()");
  });
});

describe('sanitizeFilename', () => {
  it('replaces non-alphanumerics with underscores and lower-cases', () => {
    expect(sanitizeFilename('Sales Team (EMEA)')).toBe('sales_team__emea_');
  });

  it('leaves an already-safe token untouched apart from case', () => {
    expect(sanitizeFilename('Group123')).toBe('group123');
  });

  it('handles an empty string', () => {
    expect(sanitizeFilename('')).toBe('');
  });
});

describe('getDateForFilename', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today's date in YYYY-MM-DD form", () => {
    vi.setSystemTime(new Date('2026-07-20T09:41:00Z'));
    expect(getDateForFilename()).toBe('2026-07-20');
  });
});

describe('downloadCSV', () => {
  it('creates a blob URL, clicks a hidden anchor, and revokes the URL', () => {
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadCSV('a,b\n1,2', 'export.csv');

    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith('blob:fake-url');
    // The temporary anchor must not linger in the DOM.
    expect(document.querySelector('a[download="export.csv"]')).toBeNull();

    createUrl.mockRestore();
    revokeUrl.mockRestore();
    clickSpy.mockRestore();
  });
});
