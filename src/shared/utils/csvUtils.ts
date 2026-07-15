/**
 * @module shared/utils/csvUtils
 * @description Shared CSV building/download helpers for export operations.
 *
 * Covers value escaping ({@link escapeCSV}), row assembly ({@link generateCSV}),
 * browser download ({@link downloadCSV}), and filename helpers
 * ({@link sanitizeFilename}, {@link getDateForFilename}).
 */

/**
 * Format a date for CSV export in `YYYY-MM-DD` form.
 *
 * @param date - A `Date`, an ISO/parseable date string, or nullish.
 * @returns The date portion of the ISO string, or `'N/A'` for nullish or
 *   unparseable input.
 *
 * @example
 * formatDateForCSV('2026-03-05T14:30:00Z'); // => '2026-03-05'
 * formatDateForCSV(null); // => 'N/A'
 */
export function formatDateForCSV(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) return 'N/A';
  return dateObj.toISOString().split('T')[0];
}

/**
 * Escape a single value for safe inclusion in a CSV field.
 *
 * Values containing a comma, newline, or double quote are wrapped in double
 * quotes with embedded quotes doubled, per RFC 4180.
 *
 * @param value - The cell value to escape; nullish becomes an empty field.
 * @returns The escaped field string.
 *
 * @example
 * escapeCSV('a,b');   // => '"a,b"'
 * escapeCSV('he "x"'); // => '"he ""x"""'
 * escapeCSV(null);     // => ''
 */
export function escapeCSV(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  // Escape double quotes and wrap in quotes if contains comma, newline, or quote
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Assemble a full CSV document from a header row and data rows.
 *
 * Every cell (headers included) is passed through {@link escapeCSV}. Lines are
 * joined with `\n`.
 *
 * @param headers - Column header labels.
 * @param rows - Data rows; each is an array of cell values aligned to `headers`.
 * @returns The complete CSV text.
 */
export function generateCSV(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  const headerLine = headers.map((h) => escapeCSV(h)).join(',');
  const dataLines = rows.map((row) => row.map((cell) => escapeCSV(cell)).join(','));
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Trigger a browser download of CSV content as a file.
 *
 * Creates a temporary object URL and a hidden anchor, clicks it, then revokes
 * the URL. Requires a DOM (runs in the side panel).
 *
 * @param content - The CSV text to download.
 * @param filename - The suggested download filename (include the `.csv` extension).
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Sanitize a string for use in a filename.
 *
 * Replaces every non-alphanumeric character with `_` and lower-cases the result.
 *
 * @param name - The raw name (e.g. a group name).
 * @returns A filesystem-safe, lower-cased token.
 *
 * @example
 * sanitizeFilename('Sales Team (EMEA)'); // => 'sales_team__emea_'
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/**
 * Current date in `YYYY-MM-DD` form, for stamping export filenames.
 *
 * @returns Today's date as an ISO date string (date portion only).
 */
export function getDateForFilename(): string {
  return new Date().toISOString().split('T')[0];
}
