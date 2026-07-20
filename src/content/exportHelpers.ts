/**
 * @module content/exportHelpers
 * @description Pure export formatting/download helpers for the content script.
 *
 * These turn fetched Okta records into a downloadable artifact. All CSV cells are
 * routed through `escapeCSV` (RFC 4180 quoting + spreadsheet-formula-injection
 * neutralization) because profile fields are end-user-controlled.
 *
 * @see `content/index` for the exportGroupMembers handler that consumes these.
 */

import type { OktaUser } from '../shared/types';
import { escapeCSV } from '../shared/utils/csvUtils';

/**
 * Serialize a list of Okta users to CSV text.
 *
 * @param users - The users to serialize; an empty list yields an empty string.
 * @returns CSV content with a header row and one row per user.
 */
export function convertToCSV(users: OktaUser[]): string {
  if (users.length === 0) return '';

  const headers = ['ID', 'Email', 'First Name', 'Last Name', 'Status'];
  const rows = users.map((u) => [
    u.id,
    u.profile.login,
    u.profile.firstName,
    u.profile.lastName,
    u.status,
  ]);

  // Profile fields are end-user-controlled: every cell goes through escapeCSV
  // (RFC 4180 quoting + formula-injection neutralization).
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => escapeCSV(cell)).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Trigger a browser download of in-memory content via an object URL.
 *
 * @param filename - The suggested download filename.
 * @param content - The file body.
 * @param mimeType - The blob MIME type (e.g. `text/csv`).
 */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
