/**
 * @module sidepanel/export/descriptors/authPolicies
 * @description The Auth Policies export descriptor — a whole-org descriptor.
 *
 * Exports every app authentication policy (`ACCESS_POLICY`) in the org with its
 * identity, lifecycle status, evaluation priority and timestamps. Reuses the shared
 * {@link oktaPolicyListItemSchema} so the export validates rows with exactly the
 * same lenient contract as the Auth Policies tab (ADR-0006).
 *
 * The policies list endpoint exposes no useful search parameter, so there is no raw
 * filter box. No `linkify`: `oktaAdminEntityUrl` models group/user/app only, and
 * widening it for policies is out of scope here. The `type=ACCESS_POLICY` selector
 * is carried in `defaultQuery` (see the note on the descriptor below).
 */

import type { EntityExport, ExportColumn } from '../types';
import { oktaPolicyListItemSchema, type OktaPolicyListItem } from '@/shared/schemas/okta';
import { formatDateForCSV } from '@/shared/utils/csvUtils';

/** Identity, lifecycle and timestamp columns for an auth policy. */
const policyColumns: ExportColumn<OktaPolicyListItem>[] = [
  {
    id: 'id',
    label: 'Policy ID',
    group: 'base',
    defaultEnabled: true,
    accessor: (p) => p.id,
  },
  {
    id: 'name',
    label: 'Name',
    group: 'base',
    defaultEnabled: true,
    accessor: (p) => p.name,
  },
  {
    id: 'status',
    label: 'Status',
    group: 'base',
    defaultEnabled: true,
    accessor: (p) => p.status,
  },
  {
    id: 'type',
    label: 'Type',
    group: 'base',
    defaultEnabled: true,
    accessor: (p) => p.type,
  },
  {
    id: 'priority',
    label: 'Priority',
    group: 'base',
    defaultEnabled: true,
    accessor: (p) => p.priority,
  },
  {
    id: 'description',
    label: 'Description',
    group: 'base',
    defaultEnabled: true,
    accessor: (p) => p.description,
  },
  {
    id: 'system',
    label: 'System',
    group: 'base',
    defaultEnabled: false,
    accessor: (p) => p.system,
    format: (v) => (v ? 'Yes' : 'No'),
  },
  {
    id: 'created',
    label: 'Created',
    group: 'base',
    defaultEnabled: false,
    accessor: (p) => p.created,
    format: (v) => formatDateForCSV(v as string | null | undefined),
  },
  {
    id: 'lastUpdated',
    label: 'Last Updated',
    group: 'base',
    defaultEnabled: true,
    accessor: (p) => p.lastUpdated,
    format: (v) => formatDateForCSV(v as string | null | undefined),
  },
];

/** Whole-org Auth Policies export (app authentication / sign-on policies). */
export const authPoliciesDescriptor: EntityExport<OktaPolicyListItem> = {
  id: 'auth-policies',
  displayName: 'Auth Policies',
  icon: 'shield',
  description: 'All app authentication policies in the org with their status and priority.',
  context: { kind: 'whole-org' },
  endpoint: '/api/v1/policies',
  // `type` lives here, not in `endpoint`: buildExportEndpoint appends `?<query>`
  // unconditionally, so a base that already carried a query string would produce
  // a second `?`. This resolves to `/api/v1/policies?type=ACCESS_POLICY&limit=200`.
  defaultQuery: { type: 'ACCESS_POLICY', limit: 200 },
  schema: oktaPolicyListItemSchema,
  filter: { kind: 'none' },
  columnCatalog: policyColumns,
};

export default authPoliciesDescriptor;
