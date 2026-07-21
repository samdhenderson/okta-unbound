/**
 * @module sidepanel/export/descriptors/devices
 * @description The Devices export descriptor — a whole-org device inventory export.
 *
 * Exports every device in the org (optionally narrowed by a raw SCIM `search`
 * expression) with base lifecycle + profile (platform/model/serial) columns. Uses
 * a local lenient schema so org-specific device profile fields pass through
 * untouched.
 */

import { z } from 'zod';
import { formatDateForCSV } from '@/shared/utils/csvUtils';
import type { EntityExport, ExportColumn } from '../types';

/**
 * Lenient device list-item schema. Only the fields the columns read are named;
 * `passthrough()` preserves org-specific device + profile attributes so nothing
 * is dropped at the validation boundary.
 */
const deviceSchema = z
  .object({
    id: z.string(),
    status: z.string().optional(),
    created: z.string().nullish(),
    lastUpdated: z.string().nullish(),
    profile: z
      .object({
        displayName: z.string().optional(),
        platform: z.string().optional(),
        manufacturer: z.string().optional(),
        model: z.string().optional(),
        osVersion: z.string().optional(),
        registered: z.boolean().optional(),
        serialNumber: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/** A validated Okta device list row. */
type Device = z.infer<typeof deviceSchema>;

/** The base-lifecycle + profile columns available when exporting devices. */
const deviceColumns: ExportColumn<Device>[] = [
  { id: 'id', label: 'Device ID', group: 'base', defaultEnabled: true, accessor: (d) => d.id },
  { id: 'status', label: 'Status', group: 'base', defaultEnabled: true, accessor: (d) => d.status },
  {
    id: 'created',
    label: 'Created',
    group: 'base',
    defaultEnabled: false,
    accessor: (d) => d.created,
    format: (v) => formatDateForCSV(v as string | null | undefined),
  },
  {
    id: 'lastUpdated',
    label: 'Last Updated',
    group: 'base',
    defaultEnabled: false,
    accessor: (d) => d.lastUpdated,
    format: (v) => formatDateForCSV(v as string | null | undefined),
  },
  {
    id: 'displayName',
    label: 'Name',
    group: 'profile',
    defaultEnabled: true,
    accessor: (d) => d.profile?.displayName,
  },
  {
    id: 'platform',
    label: 'Platform',
    group: 'profile',
    defaultEnabled: true,
    accessor: (d) => d.profile?.platform,
  },
  {
    id: 'manufacturer',
    label: 'Manufacturer',
    group: 'profile',
    defaultEnabled: false,
    accessor: (d) => d.profile?.manufacturer,
  },
  {
    id: 'model',
    label: 'Model',
    group: 'profile',
    defaultEnabled: true,
    accessor: (d) => d.profile?.model,
  },
  {
    id: 'osVersion',
    label: 'OS Version',
    group: 'profile',
    defaultEnabled: false,
    accessor: (d) => d.profile?.osVersion,
  },
  {
    id: 'registered',
    label: 'Registered',
    group: 'profile',
    defaultEnabled: false,
    accessor: (d) => d.profile?.registered,
    format: (v) => (v ? 'Yes' : 'No'),
  },
  {
    id: 'serialNumber',
    label: 'Serial Number',
    group: 'profile',
    defaultEnabled: false,
    accessor: (d) => d.profile?.serialNumber,
  },
];

/** Whole-org Devices export with a raw `search` filter over the device inventory. */
export const devicesDescriptor: EntityExport<Device> = {
  id: 'devices',
  displayName: 'Devices',
  icon: 'lock',
  description: 'All devices in the org with lifecycle and hardware profile attributes.',
  context: { kind: 'whole-org' },
  endpoint: '/api/v1/devices',
  defaultQuery: { limit: 200, expand: 'user' },
  schema: deviceSchema,
  filter: {
    kind: 'search',
    help: 'Okta device `search` expression (SCIM).',
    placeholder: 'status eq "ACTIVE"',
  },
  columnCatalog: deviceColumns,
};

export default devicesDescriptor;
