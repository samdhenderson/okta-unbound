// Undo Manager
// Manages undo history and provides undo functionality

import type {
  UndoAction,
  UndoActionMetadata,
  UndoHistory,
  BulkRemoveUsersMetadata,
  BulkAddUsersMetadata,
  BulkUserInfo,
  BulkActionSubItem,
  BulkRuleInfo,
  BulkActivateRulesMetadata,
  BulkDeactivateRulesMetadata,
  BulkAppUserInfo,
  BulkRemoveUsersFromAppMetadata,
  BulkAppGroupInfo,
  BulkRemoveGroupsFromAppMetadata,
  ConversionAppInfo,
  ConvertUserToGroupAssignmentMetadata
} from './undoTypes';

const UNDO_STORAGE_KEY = 'undoHistory';
const MAX_UNDO_SIZE = 10; // Maximum number of actions to keep

/**
 * Gets the current undo history from chrome.storage
 */
export async function getUndoHistory(): Promise<UndoHistory> {
  try {
    const result = await chrome.storage.local.get([UNDO_STORAGE_KEY]);
    const history = result[UNDO_STORAGE_KEY] as UndoHistory | undefined;

    if (history && Array.isArray(history.actions)) {
      return history;
    }

    return {
      actions: [],
      maxSize: MAX_UNDO_SIZE,
    };
  } catch (error) {
    console.error('[UndoManager] Failed to get undo history:', error);
    return {
      actions: [],
      maxSize: MAX_UNDO_SIZE,
    };
  }
}

/**
 * Saves the undo history to chrome.storage
 */
export async function saveUndoHistory(history: UndoHistory): Promise<void> {
  try {
    await chrome.storage.local.set({ [UNDO_STORAGE_KEY]: history });
    console.log('[UndoManager] Saved undo history:', history.actions.length, 'actions');
  } catch (error) {
    console.error('[UndoManager] Failed to save undo history:', error);
  }
}

/**
 * Logs a new action to the undo history
 */
export async function logAction(
  description: string,
  metadata: UndoActionMetadata
): Promise<UndoAction> {
  const history = await getUndoHistory();

  const action: UndoAction = {
    id: generateActionId(),
    type: metadata.type,
    timestamp: Date.now(),
    description,
    metadata,
    status: 'completed',
  };

  // Add to front of array (most recent first)
  history.actions.unshift(action);

  // Trim to max size
  if (history.actions.length > history.maxSize) {
    history.actions = history.actions.slice(0, history.maxSize);
  }

  await saveUndoHistory(history);
  console.log('[UndoManager] Logged action:', action.description);

  return action;
}

/**
 * Logs a bulk remove users action to the undo history
 * This is more efficient than logging individual actions for bulk operations
 */
export async function logBulkRemoveAction(
  groupId: string,
  groupName: string,
  users: BulkUserInfo[],
  operationType: 'deprovisioned' | 'inactive' | 'custom_status' | 'multi_status',
  targetStatus?: string
): Promise<UndoAction> {
  const history = await getUndoHistory();

  let description: string;
  if (operationType === 'deprovisioned') {
    description = `Removed ${users.length} deprovisioned user${users.length !== 1 ? 's' : ''} from ${groupName}`;
  } else if (operationType === 'inactive') {
    description = `Removed ${users.length} inactive user${users.length !== 1 ? 's' : ''} from ${groupName}`;
  } else if (operationType === 'multi_status' && targetStatus) {
    const statusCount = targetStatus.split(',').length;
    description = `Removed ${users.length} user${users.length !== 1 ? 's' : ''} (${statusCount} status types) from ${groupName}`;
  } else {
    description = `Removed ${users.length} ${targetStatus || 'filtered'} user${users.length !== 1 ? 's' : ''} from ${groupName}`;
  }

  const metadata: BulkRemoveUsersMetadata = {
    type: 'BULK_REMOVE_USERS_FROM_GROUP',
    users,
    groupId,
    groupName,
    operationType,
    targetStatus,
  };

  const action: UndoAction = {
    id: generateActionId(),
    type: 'BULK_REMOVE_USERS_FROM_GROUP',
    timestamp: Date.now(),
    description,
    metadata,
    status: 'completed',
    subItems: generateSubItems(users.map(u => u.userId))
  };

  // Add to front of array (most recent first)
  history.actions.unshift(action);

  // Trim to max size
  if (history.actions.length > history.maxSize) {
    history.actions = history.actions.slice(0, history.maxSize);
  }

  await saveUndoHistory(history);
  console.log('[UndoManager] Logged bulk action:', action.description);

  return action;
}

/**
 * Logs a bulk add users action to the undo history
 */
export async function logBulkAddAction(
  groupId: string,
  groupName: string,
  users: BulkUserInfo[]
): Promise<UndoAction> {
  const history = await getUndoHistory();

  const description = `Added ${users.length} user${users.length !== 1 ? 's' : ''} to ${groupName}`;

  const metadata: BulkAddUsersMetadata = {
    type: 'BULK_ADD_USERS_TO_GROUP',
    users,
    groupId,
    groupName,
  };

  const action: UndoAction = {
    id: generateActionId(),
    type: 'BULK_ADD_USERS_TO_GROUP',
    timestamp: Date.now(),
    description,
    metadata,
    status: 'completed',
    subItems: generateSubItems(users.map(u => u.userId))
  };

  // Add to front of array (most recent first)
  history.actions.unshift(action);

  // Trim to max size
  if (history.actions.length > history.maxSize) {
    history.actions = history.actions.slice(0, history.maxSize);
  }

  await saveUndoHistory(history);
  console.log('[UndoManager] Logged bulk add action:', action.description);

  return action;
}

/**
 * Marks an action as undone
 */
export async function markActionAsUndone(actionId: string): Promise<void> {
  const history = await getUndoHistory();
  const action = history.actions.find(a => a.id === actionId);

  if (action) {
    action.status = 'undone';
    await saveUndoHistory(history);
    console.log('[UndoManager] Marked action as undone:', action.description);
  }
}

/**
 * Marks an action as failed
 */
export async function markActionAsFailed(actionId: string): Promise<void> {
  const history = await getUndoHistory();
  const action = history.actions.find(a => a.id === actionId);

  if (action) {
    action.status = 'failed';
    await saveUndoHistory(history);
    console.log('[UndoManager] Marked action as failed:', action.description);
  }
}

/**
 * Marks an action as partially undone (some operations succeeded, some failed)
 */
export async function markActionAsPartial(actionId: string): Promise<void> {
  const history = await getUndoHistory();
  const action = history.actions.find(a => a.id === actionId);

  if (action) {
    action.status = 'partial';
    await saveUndoHistory(history);
    console.log('[UndoManager] Marked action as partial:', action.description);
  }
}

/**
 * Gets all undoable actions (completed actions that haven't been undone)
 */
export async function getUndoableActions(): Promise<UndoAction[]> {
  const history = await getUndoHistory();
  return history.actions.filter(a => a.status === 'completed');
}

/**
 * Clears the entire undo history
 */
export async function clearUndoHistory(): Promise<void> {
  const history: UndoHistory = {
    actions: [],
    maxSize: MAX_UNDO_SIZE,
  };
  await saveUndoHistory(history);
  console.log('[UndoManager] Cleared undo history');
}

/**
 * Generates a unique action ID
 */
function generateActionId(): string {
  return `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Formats a timestamp as a relative time string
 */
export function formatActionTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'just now';
  } else if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }
}

/**
 * Helper function to generate sub-items for bulk actions
 */
function generateSubItems(itemIds: string[]): BulkActionSubItem[] {
  return itemIds.map(id => ({
    id,
    status: 'completed' as const
  }));
}

/**
 * Updates a specific sub-item's status
 */
export async function updateSubItemStatus(
  actionId: string,
  subItemId: string,
  status: BulkActionSubItem['status']
): Promise<void> {
  const history = await getUndoHistory();
  const action = history.actions.find(a => a.id === actionId);

  if (action && action.subItems) {
    const subItem = action.subItems.find(si => si.id === subItemId);
    if (subItem) {
      subItem.status = status;
      if (status === 'undone') {
        subItem.timestamp = Date.now();
      }

      // Update overall action status
      const allUndone = action.subItems.every(si => si.status === 'undone');
      const allFailed = action.subItems.every(si => si.status === 'failed');
      const someUndone = action.subItems.some(si => si.status === 'undone');
      const someFailed = action.subItems.some(si => si.status === 'failed');

      if (allUndone) {
        action.status = 'undone';
      } else if (allFailed) {
        action.status = 'failed';
      } else if (someUndone || someFailed) {
        action.status = 'partial';
      }

      await saveUndoHistory(history);
      console.log('[UndoManager] Updated sub-item status:', subItemId, status);
    }
  }
}

/**
 * Get remaining (not undone) sub-items for an action
 */
export async function getRemainingSubItems(actionId: string): Promise<BulkActionSubItem[]> {
  const history = await getUndoHistory();
  const action = history.actions.find(a => a.id === actionId);

  if (!action || !action.subItems) {
    return [];
  }

  return action.subItems.filter(si => si.status === 'completed');
}

/**
 * Logs a bulk rule activation action
 */
export async function logBulkActivateRulesAction(
  rules: BulkRuleInfo[]
): Promise<UndoAction> {
  const description = `Activated ${rules.length} rule${rules.length !== 1 ? 's' : ''}`;

  const metadata: BulkActivateRulesMetadata = {
    type: 'BULK_ACTIVATE_RULES',
    rules
  };

  const action: UndoAction = {
    id: generateActionId(),
    type: 'BULK_ACTIVATE_RULES',
    timestamp: Date.now(),
    description,
    metadata,
    status: 'completed',
    subItems: generateSubItems(rules.map(r => r.ruleId))
  };

  const history = await getUndoHistory();
  history.actions.unshift(action);

  if (history.actions.length > history.maxSize) {
    history.actions = history.actions.slice(0, history.maxSize);
  }

  await saveUndoHistory(history);
  console.log('[UndoManager] Logged bulk activate rules action:', action.description);

  return action;
}

/**
 * Logs a bulk rule deactivation action
 */
export async function logBulkDeactivateRulesAction(
  rules: BulkRuleInfo[]
): Promise<UndoAction> {
  const description = `Deactivated ${rules.length} rule${rules.length !== 1 ? 's' : ''}`;

  const metadata: BulkDeactivateRulesMetadata = {
    type: 'BULK_DEACTIVATE_RULES',
    rules
  };

  const action: UndoAction = {
    id: generateActionId(),
    type: 'BULK_DEACTIVATE_RULES',
    timestamp: Date.now(),
    description,
    metadata,
    status: 'completed',
    subItems: generateSubItems(rules.map(r => r.ruleId))
  };

  const history = await getUndoHistory();
  history.actions.unshift(action);

  if (history.actions.length > history.maxSize) {
    history.actions = history.actions.slice(0, history.maxSize);
  }

  await saveUndoHistory(history);
  console.log('[UndoManager] Logged bulk deactivate rules action:', action.description);

  return action;
}

/**
 * Logs a bulk remove users from app action
 */
export async function logBulkRemoveUsersFromAppAction(
  appId: string,
  appName: string,
  users: BulkAppUserInfo[]
): Promise<UndoAction> {
  const description = `Removed ${users.length} user${users.length !== 1 ? 's' : ''} from ${appName}`;

  const metadata: BulkRemoveUsersFromAppMetadata = {
    type: 'BULK_REMOVE_USERS_FROM_APP',
    users,
    appId,
    appName
  };

  const action: UndoAction = {
    id: generateActionId(),
    type: 'BULK_REMOVE_USERS_FROM_APP',
    timestamp: Date.now(),
    description,
    metadata,
    status: 'completed',
    subItems: generateSubItems(users.map(u => u.userId))
  };

  const history = await getUndoHistory();
  history.actions.unshift(action);

  if (history.actions.length > history.maxSize) {
    history.actions = history.actions.slice(0, history.maxSize);
  }

  await saveUndoHistory(history);
  console.log('[UndoManager] Logged bulk remove users from app action:', action.description);

  return action;
}

/**
 * Logs a bulk remove groups from app action
 */
export async function logBulkRemoveGroupsFromAppAction(
  appId: string,
  appName: string,
  groups: BulkAppGroupInfo[]
): Promise<UndoAction> {
  const description = `Removed ${groups.length} group${groups.length !== 1 ? 's' : ''} from ${appName}`;

  const metadata: BulkRemoveGroupsFromAppMetadata = {
    type: 'BULK_REMOVE_GROUPS_FROM_APP',
    groups,
    appId,
    appName
  };

  const action: UndoAction = {
    id: generateActionId(),
    type: 'BULK_REMOVE_GROUPS_FROM_APP',
    timestamp: Date.now(),
    description,
    metadata,
    status: 'completed',
    subItems: generateSubItems(groups.map(g => g.groupId))
  };

  const history = await getUndoHistory();
  history.actions.unshift(action);

  if (history.actions.length > history.maxSize) {
    history.actions = history.actions.slice(0, history.maxSize);
  }

  await saveUndoHistory(history);
  console.log('[UndoManager] Logged bulk remove groups from app action:', action.description);

  return action;
}

/**
 * Logs a convert user to group assignment action
 */
export async function logConvertUserToGroupAssignmentAction(
  userId: string,
  userEmail: string,
  userName: string,
  targetGroupId: string,
  targetGroupName: string,
  apps: ConversionAppInfo[],
  userAssignmentsRemoved: boolean
): Promise<UndoAction> {
  const description = `Converted ${apps.length} app assignment${apps.length !== 1 ? 's' : ''} for ${userName} to group ${targetGroupName}`;

  const metadata: ConvertUserToGroupAssignmentMetadata = {
    type: 'CONVERT_USER_TO_GROUP_ASSIGNMENT',
    userId,
    userEmail,
    userName,
    targetGroupId,
    targetGroupName,
    apps,
    userAssignmentsRemoved
  };

  const action: UndoAction = {
    id: generateActionId(),
    type: 'CONVERT_USER_TO_GROUP_ASSIGNMENT',
    timestamp: Date.now(),
    description,
    metadata,
    status: 'completed',
    subItems: generateSubItems(apps.map(a => a.appId))
  };

  const history = await getUndoHistory();
  history.actions.unshift(action);

  if (history.actions.length > history.maxSize) {
    history.actions = history.actions.slice(0, history.maxSize);
  }

  await saveUndoHistory(history);
  console.log('[UndoManager] Logged convert user to group assignment action:', action.description);

  return action;
}

/**
 * Updates sub-items for existing bulk actions to initialize them
 * (for backward compatibility with existing actions)
 */
export async function initializeSubItemsForBulkActions(): Promise<void> {
  const history = await getUndoHistory();
  let updated = false;

  for (const action of history.actions) {
    // Only initialize if action doesn't have subItems
    if (!action.subItems) {
      const metadata = action.metadata;

      if (metadata.type === 'BULK_REMOVE_USERS_FROM_GROUP' || metadata.type === 'BULK_ADD_USERS_TO_GROUP') {
        action.subItems = generateSubItems(metadata.users.map(u => u.userId));
        updated = true;
      } else if (metadata.type === 'BULK_ACTIVATE_RULES' || metadata.type === 'BULK_DEACTIVATE_RULES') {
        action.subItems = generateSubItems(metadata.rules.map(r => r.ruleId));
        updated = true;
      } else if (metadata.type === 'BULK_REMOVE_USERS_FROM_APP') {
        action.subItems = generateSubItems(metadata.users.map(u => u.userId));
        updated = true;
      } else if (metadata.type === 'BULK_REMOVE_GROUPS_FROM_APP') {
        action.subItems = generateSubItems(metadata.groups.map(g => g.groupId));
        updated = true;
      } else if (metadata.type === 'CONVERT_USER_TO_GROUP_ASSIGNMENT') {
        action.subItems = generateSubItems(metadata.apps.map(a => a.appId));
        updated = true;
      }
    }
  }

  if (updated) {
    await saveUndoHistory(history);
    console.log('[UndoManager] Initialized sub-items for existing bulk actions');
  }
}
