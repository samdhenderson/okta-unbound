/**
 * @module sidepanel/export/descriptors/groupRules
 * @description The Group Rules export descriptor — every group rule in the org.
 *
 * Exports each rule from `GET /api/v1/groups/rules` with its identity, status,
 * condition expression, and the groups it assigns users to. Whole-org scope; the
 * rules list endpoint exposes no useful search parameter, so no raw filter box.
 */

import { z } from 'zod';
import type { EntityExport } from '../types';

/**
 * Lenient group-rule list-item schema for export. Only `id` is required and the
 * status is a free string (not the strict ACTIVE/INACTIVE enum the consolidation
 * flow uses), so no rule is ever dropped from a report.
 */
const exportRuleSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    status: z.string().optional(),
    type: z.string().optional(),
    conditions: z
      .object({ expression: z.object({ value: z.string().optional() }).passthrough().optional() })
      .passthrough()
      .optional(),
    actions: z
      .object({
        assignUserToGroups: z
          .object({ groupIds: z.array(z.string()).optional() })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
type ExportRule = z.infer<typeof exportRuleSchema>;

/** Whole-org Group Rules export (no filter, no per-row deep link). */
export const rulesDescriptor: EntityExport<ExportRule> = {
  id: 'group-rules',
  displayName: 'Group Rules',
  icon: 'bolt',
  description: 'All group rules in the org with their conditions and assigned groups.',
  context: { kind: 'whole-org' },
  endpoint: '/api/v1/groups/rules',
  defaultQuery: { limit: 200 },
  schema: exportRuleSchema,
  filter: { kind: 'none' },
  columnCatalog: [
    {
      id: 'id',
      label: 'Rule ID',
      group: 'base',
      defaultEnabled: true,
      accessor: (r: ExportRule) => r.id,
    },
    {
      id: 'name',
      label: 'Name',
      group: 'base',
      defaultEnabled: true,
      accessor: (r: ExportRule) => r.name,
    },
    {
      id: 'status',
      label: 'Status',
      group: 'base',
      defaultEnabled: true,
      accessor: (r: ExportRule) => r.status,
    },
    {
      id: 'type',
      label: 'Type',
      group: 'base',
      defaultEnabled: false,
      accessor: (r: ExportRule) => r.type,
    },
    {
      id: 'expression',
      label: 'Condition',
      group: 'base',
      defaultEnabled: true,
      accessor: (r: ExportRule) => r.conditions?.expression?.value,
    },
    {
      id: 'assignedGroups',
      label: 'Assigned Groups',
      group: 'base',
      defaultEnabled: true,
      accessor: (r: ExportRule) => r.actions?.assignUserToGroups?.groupIds,
      format: (value: unknown): string => (Array.isArray(value) ? value.join('; ') : ''),
    },
  ],
};

export default rulesDescriptor;
