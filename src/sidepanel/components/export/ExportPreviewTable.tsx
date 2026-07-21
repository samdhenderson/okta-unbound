/**
 * @module sidepanel/components/export/ExportPreviewTable
 * @description Read-only preview of the first rows an export will produce.
 *
 * Renders the enabled columns as a raw `<table>` inside an `overflow-x-auto`
 * scroller (there is no shared DataTable — this follows the GroupComparisonModal
 * pattern) using the exact projection the engine uses. Shows a summary banner, an
 * optional dropped-rows note, and an info alert when the row cap was hit. When the
 * descriptor declares a `linkify` column, that cell deep-links into the Okta Admin
 * Console.
 */
import React from 'react';
import { AlertMessage } from '../shared';
import { oktaAdminEntityUrl } from '../../../shared/utils/oktaUrl';
import type { ExportColumn, IdLinkify } from '../../export/types';

/** How many rows the preview shows before deferring the rest to the export. */
const PREVIEW_LIMIT = 100;

/** Props for {@link ExportPreviewTable}. */
interface ExportPreviewTableProps {
  /** Enabled columns, in catalog order (headers + projection order). */
  columns: ExportColumn<unknown>[];
  /** All fetched rows; only the first {@link PREVIEW_LIMIT} are shown. */
  rows: unknown[];
  /** Rows skipped for failing schema validation. */
  dropped: number;
  /** Whether the descriptor's row cap was hit. */
  capped: boolean;
  /** Optional deep-link configuration for one column. */
  linkify?: IdLinkify;
  /** Okta org origin used to build the deep links. */
  oktaOrigin?: string;
}

/** Project a single cell exactly as the export engine does. */
function projectCell(column: ExportColumn<unknown>, row: unknown): string {
  const raw = column.accessor(row);
  if (column.format) {
    const formatted = column.format(raw, row);
    return formatted == null ? '' : String(formatted);
  }
  return raw == null ? '' : String(raw);
}

/**
 * Renders the export preview: summary banner, diagnostics, and the projected
 * first-rows table.
 */
const ExportPreviewTable: React.FC<ExportPreviewTableProps> = ({
  columns,
  rows,
  dropped,
  capped,
  linkify,
  oktaOrigin,
}) => {
  const total = rows.length;

  if (total === 0) {
    return (
      <div className="rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
        No rows matched — nothing to preview.
      </div>
    );
  }

  const shown = Math.min(PREVIEW_LIMIT, total);
  const linkColumn = linkify
    ? columns.find((column) => column.id === linkify.idColumnId)
    : undefined;

  return (
    <div className="space-y-3">
      <div className="text-sm text-neutral-700">
        Showing {shown} of {total} — all {total} rows will export.
      </div>

      {dropped > 0 && (
        <p className="text-xs text-neutral-500">{dropped} rows skipped (unrecognized shape)</p>
      )}

      {capped && (
        <AlertMessage
          message={{
            type: 'info',
            text: 'This export hit the row cap — only the first rows are included.',
          }}
        />
      )}

      <div className="overflow-x-auto rounded-md border border-neutral-200">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="p-2 text-left font-semibold text-neutral-700 whitespace-nowrap"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, PREVIEW_LIMIT).map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-neutral-100 last:border-b-0">
                {columns.map((column) => {
                  const value = projectCell(column, row);
                  const href =
                    linkColumn && column.id === linkColumn.id && linkify
                      ? oktaAdminEntityUrl(oktaOrigin, linkify.entityType, value)
                      : null;
                  return (
                    <td key={column.id} className="p-2 text-neutral-700 whitespace-nowrap">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-text hover:underline"
                        >
                          {value}
                        </a>
                      ) : (
                        value
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExportPreviewTable;
