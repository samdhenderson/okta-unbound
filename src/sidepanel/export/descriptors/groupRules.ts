/**
 * @module sidepanel/export/descriptors/groupRules
 * @description The Group Rules export descriptor — every group rule in the org.
 *
 * Exports each rule from `GET /api/v1/groups/rules` with its identity, status,
 * condition expression, and the groups it assigns users to. Whole-org scope; the
 * rules list endpoint exposes no useful search parameter, so no raw filter box.
 */

import { oktaGroupRuleSchema, type OktaGroupRuleResponse } from '@/shared/schemas/okta';
import type { EntityExport } from '../types';

/** Whole-org Group Rules export (no filter, no per-row deep link). */
export const rulesDescriptor: EntityExport<OktaGroupRuleResponse> = {
  id: 'group-rules',
  displayName: 'Group Rules',
  icon: 'bolt',
  description: 'All group rules in the org with their conditions and assigned groups.',
  context: { kind: 'whole-org' },
  endpoint: '/api/v1/groups/rules',
  defaultQuery: { limit: 200 },
  schema: oktaGroupRuleSchema,
  filter: { kind: 'none' },
  columnCatalog: [
    {
      id: 'id',
      label: 'Rule ID',
      group: 'base',
      defaultEnabled: true,
      accessor: (r: OktaGroupRuleResponse) => r.id,
    },
    {
      id: 'name',
      label: 'Name',
      group: 'base',
      defaultEnabled: true,
      accessor: (r: OktaGroupRuleResponse) => r.name,
    },
    {
      id: 'status',
      label: 'Status',
      group: 'base',
      defaultEnabled: true,
      accessor: (r: OktaGroupRuleResponse) => r.status,
    },
    {
      id: 'type',
      label: 'Type',
      group: 'base',
      defaultEnabled: false,
      accessor: (r: OktaGroupRuleResponse) => r.type,
    },
    {
      id: 'expression',
      label: 'Condition',
      group: 'base',
      defaultEnabled: true,
      accessor: (r: OktaGroupRuleResponse) => r.conditions?.expression?.value,
    },
    {
      id: 'assignedGroups',
      label: 'Assigned Groups',
      group: 'base',
      defaultEnabled: true,
      accessor: (r: OktaGroupRuleResponse) => r.actions?.assignUserToGroups?.groupIds,
      format: (value: unknown): string => (Array.isArray(value) ? value.join('; ') : ''),
    },
  ],
};

export default rulesDescriptor;
