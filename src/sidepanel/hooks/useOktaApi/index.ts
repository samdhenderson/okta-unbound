/**
 * @module hooks/useOktaApi
 * @description Public barrel for the module-per-concern Okta API client.
 *
 * @remarks
 * Re-exports the shared types plus each `create*Operations` factory and the
 * standalone {@link parseNextLink}/{@link deepMergeProfiles} utilities. The
 * consuming `useOktaApi` hook wires a single `CoreApi` (see {@link createCoreApi})
 * through these factories to assemble the flat operations object the UI calls.
 * Each factory owns one concern (members, cleanup, discovery, users, export, …),
 * keeping this layer free of god-object growth.
 */

export * from './types';
export { createCoreApi } from './core';
export { createGroupMemberOperations } from './groupMembers';
export { createGroupCleanupOperations } from './groupCleanup';
export { createGroupBulkOperations } from './groupBulkOps';
export { createGroupDiscoveryOperations } from './groupDiscovery';
export { createUserOperations } from './userOperations';
export { createExportOperations } from './exportOperations';
export { createRuleImpactOperations } from './ruleImpact';
export { createRuleWriteOperations } from './ruleWrites';
export { parseNextLink, deepMergeProfiles } from './utilities';
