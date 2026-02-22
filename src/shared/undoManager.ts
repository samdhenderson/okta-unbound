// Undo Manager
// Manages action history for audit logging

import type {
  UndoAction,
  UndoActionMetadata,
  UndoHistory,
  BulkRemoveUsersMetadata,
  BulkUserInfo,
} from './undoTypes';

const UNDO_STORAGE_KEY = 'undoHistory';
const MAX_UNDO_SIZE = 50;

/**
 * Gets the current action history from chrome.storage
 */
export async function getUndoHistory(): Promise<UndoHistory> {
  try {
    const result = await chrome.storage.local.get([UNDO_STORAGE_KEY]);
    const history = result[UNDO_STORAGE_KEY] as UndoHistory | undefined;

    if (history && Array.isArray(history.actions)) {
      return history;
    }

    return { actions: [], maxSize: MAX_UNDO_SIZE };
  } catch (error) {
    console.error('[UndoManager] Failed to get history:', error);
    return { actions: [], maxSize: MAX_UNDO_SIZE };
  }
}

/**
 * Saves the action history to chrome.storage
 */
async function saveUndoHistory(history: UndoHistory): Promise<void> {
  try {
    await chrome.storage.local.set({ [UNDO_STORAGE_KEY]: history });
  } catch (error) {
    console.error('[UndoManager] Failed to save history:', error);
  }
}

/**
 * Generates a unique action ID
 */
function generateActionId(): string {
  return `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Logs a new action to the history
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

  history.actions.unshift(action);

  if (history.actions.length > history.maxSize) {
    history.actions = history.actions.slice(0, history.maxSize);
  }

  await saveUndoHistory(history);
  return action;
}

/**
 * Logs a bulk remove users action
 */
export async function logBulkRemoveAction(
  groupId: string,
  groupName: string,
  users: BulkUserInfo[],
  operationType: 'deprovisioned' | 'inactive' | 'custom_status' | 'multi_status',
  targetStatus?: string
): Promise<UndoAction> {
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

  return logAction(description, metadata);
}

/**
 * Clears the entire action history
 */
export async function clearUndoHistory(): Promise<void> {
  await saveUndoHistory({ actions: [], maxSize: MAX_UNDO_SIZE });
}

/**
 * Formats a timestamp as a relative time string
 */
export function formatActionTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}
