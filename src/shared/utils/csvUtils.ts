/**
 * Shared CSV utilities for export operations
 */

/**
 * Format a date for CSV export (YYYY-MM-DD format)
 */
export function formatDateForCSV(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) return 'N/A';
  return dateObj.toISOString().split('T')[0];
}

/**
 * Escape a value for safe CSV inclusion
 * Handles commas, newlines, and double quotes
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
 * Generate CSV content from headers and rows
 */
export function generateCSV(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerLine = headers.map(h => escapeCSV(h)).join(',');
  const dataLines = rows.map(row => row.map(cell => escapeCSV(cell)).join(','));
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Download CSV content as a file
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
 * Sanitize a string for use in filenames
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/**
 * Get current date in YYYY-MM-DD format for filenames
 */
export function getDateForFilename(): string {
  return new Date().toISOString().split('T')[0];
}
