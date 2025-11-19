// React Hook for Undo Manager
// Provides undo functionality with React state management

import { useState, useEffect, useCallback } from 'react';
import type { UndoAction, UndoActionMetadata, UndoResult } from '../../shared/undoTypes';
import {
  getUndoableActions,
  logAction,
  markActionAsUndone,
  markActionAsFailed,
  clearUndoHistory,
} from '../../shared/undoManager';
import type { MessageRequest, MessageResponse } from '../../shared/types';

export interface UseUndoManagerReturn {
  undoableActions: UndoAction[];
  isLoading: boolean;
  error: string | null;
  refreshUndoHistory: () => Promise<void>;
  performUndo: (action: UndoAction, targetTabId: number) => Promise<UndoResult>;
  logNewAction: (description: string, metadata: UndoActionMetadata) => Promise<UndoAction>;
  clearHistory: () => Promise<void>;
}

export function useUndoManager(): UseUndoManagerReturn {
  const [undoableActions, setUndoableActions] = useState<UndoAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load undo history on mount
  const refreshUndoHistory = useCallback(async () => {
    try {
      const actions = await getUndoableActions();
      setUndoableActions(actions);
    } catch (err) {
      console.error('[useUndoManager] Failed to load undo history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load undo history');
    }
  }, []);

  useEffect(() => {
    refreshUndoHistory();
  }, [refreshUndoHistory]);

  // Listen for storage changes to update undo history in real-time
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.undoHistory) {
        console.log('[useUndoManager] Undo history changed, refreshing');
        refreshUndoHistory();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [refreshUndoHistory]);

  /**
   * Performs an undo operation based on the action type
   */
  const performUndo = useCallback(async (action: UndoAction, targetTabId: number): Promise<UndoResult> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useUndoManager] Performing undo for action:', action.id, action.type);

      let request: MessageRequest;
      let reverseDescription: string;

      switch (action.type) {
        case 'REMOVE_USER_FROM_GROUP': {
          const metadata = action.metadata;
          if (metadata.type !== 'REMOVE_USER_FROM_GROUP') {
            throw new Error('Invalid metadata for REMOVE_USER_FROM_GROUP action');
          }

          // To undo a removal, we need to add the user back
          request = {
            action: 'makeApiRequest',
            endpoint: `/api/v1/groups/${metadata.groupId}/users/${metadata.userId}`,
            method: 'PUT',
          };
          reverseDescription = `Re-added ${metadata.userName} to ${metadata.groupName}`;
          break;
        }

        case 'ADD_USER_TO_GROUP': {
          const metadata = action.metadata;
          if (metadata.type !== 'ADD_USER_TO_GROUP') {
            throw new Error('Invalid metadata for ADD_USER_TO_GROUP action');
          }

          // To undo an addition, we need to remove the user
          request = {
            action: 'makeApiRequest',
            endpoint: `/api/v1/groups/${metadata.groupId}/users/${metadata.userId}`,
            method: 'DELETE',
          };
          reverseDescription = `Removed ${metadata.userName} from ${metadata.groupName}`;
          break;
        }

        case 'ACTIVATE_RULE': {
          const metadata = action.metadata;
          if (metadata.type !== 'ACTIVATE_RULE') {
            throw new Error('Invalid metadata for ACTIVATE_RULE action');
          }

          // To undo activation, deactivate the rule
          request = {
            action: 'deactivateRule',
            ruleId: metadata.ruleId,
          };
          reverseDescription = `Deactivated rule: ${metadata.ruleName}`;
          break;
        }

        case 'DEACTIVATE_RULE': {
          const metadata = action.metadata;
          if (metadata.type !== 'DEACTIVATE_RULE') {
            throw new Error('Invalid metadata for DEACTIVATE_RULE action');
          }

          // To undo deactivation, activate the rule
          request = {
            action: 'activateRule',
            ruleId: metadata.ruleId,
          };
          reverseDescription = `Activated rule: ${metadata.ruleName}`;
          break;
        }

        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      // Send the undo request to the content script
      const response: MessageResponse = await chrome.tabs.sendMessage(targetTabId, request);

      if (response.success) {
        // Mark the action as undone
        await markActionAsUndone(action.id);
        await refreshUndoHistory();

        console.log('[useUndoManager] Successfully undone action:', action.id);

        return {
          success: true,
          actionUndone: action,
        };
      } else {
        // Mark the action as failed
        await markActionAsFailed(action.id);
        throw new Error(response.error || 'Undo operation failed');
      }
    } catch (err) {
      console.error('[useUndoManager] Failed to perform undo:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to undo action';
      setError(errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, [refreshUndoHistory]);

  /**
   * Logs a new action to the undo history
   */
  const logNewAction = useCallback(async (
    description: string,
    metadata: UndoActionMetadata
  ): Promise<UndoAction> => {
    const action = await logAction(description, metadata);
    await refreshUndoHistory();
    return action;
  }, [refreshUndoHistory]);

  /**
   * Clears the entire undo history
   */
  const clearHistory = useCallback(async () => {
    await clearUndoHistory();
    await refreshUndoHistory();
  }, [refreshUndoHistory]);

  return {
    undoableActions,
    isLoading,
    error,
    refreshUndoHistory,
    performUndo,
    logNewAction,
    clearHistory,
  };
}
