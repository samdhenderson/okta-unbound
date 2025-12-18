// Undo Manager
// Manages undo history and provides undo functionality

import type { UndoAction, UndoActionMetadata, UndoHistory, BulkRemoveUsersMetadata, BulkAddUsersMetadata, BulkUserInfo } from './undoTypes';

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
