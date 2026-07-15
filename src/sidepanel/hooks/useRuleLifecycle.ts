/**
 * @module sidepanel/hooks/useRuleLifecycle
 * @description Activate/deactivate a group rule, with undo + audit logging.
 *
 * Extracted from `RulesTab` during its §7 decomposition. The two flows were
 * near-identical ~120-line blocks; they are unified here behind one
 * `runLifecycle(ruleId, kind)` while preserving the exact audit-entry shape,
 * undo metadata, current-user attribution, and post-mutation reload behavior.
 *
 * @remarks Keeps the raw `chrome.tabs.sendMessage` transport verbatim (the §8
 * scheduler migration is deliberately out of scope here); this file is
 * grandfathered in the ESLint `no-restricted-syntax` override.
 */

import { useCallback } from 'react';
import type { FormattedRule, AuditLogEntry } from '../../shared/types';
import { logAction } from '../../shared/undoManager';
import { auditStore } from '../../shared/storage/auditStore';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('RulesTab');

/** Which lifecycle transition to run. */
type LifecycleKind = 'activate' | 'deactivate';

/** Per-kind copy/action wiring, keeping the two flows byte-faithful to the original. */
const LIFECYCLE = {
  activate: {
    action: 'activateRule' as const,
    auditAction: 'activate_rule' as const,
    undoType: 'ACTIVATE_RULE' as const,
    gerund: 'Activating',
    verbPast: 'Activated',
    failMessage: 'Failed to activate rule',
    errorLog: 'Activation error:',
  },
  deactivate: {
    action: 'deactivateRule' as const,
    auditAction: 'deactivate_rule' as const,
    undoType: 'DEACTIVATE_RULE' as const,
    gerund: 'Deactivating',
    verbPast: 'Deactivated',
    failMessage: 'Failed to deactivate rule',
    errorLog: 'Deactivation error:',
  },
};

/** Options for {@link useRuleLifecycle}. */
interface UseRuleLifecycleOptions {
  /** Connected Okta tab id; the hook no-ops when absent. */
  targetTabId?: number;
  /** Currently loaded rules, used to resolve a rule's name/groups for logging. */
  rules: FormattedRule[];
  /** Reload rules after a successful mutation (preserves the original `loadRules()` call). */
  reload: () => Promise<void>;
  /** Surface an error message in the tab's banner. */
  onError: (message: string) => void;
}

/** Return shape of {@link useRuleLifecycle}. */
interface UseRuleLifecycleReturn {
  /** Activate an inactive rule (immediate). */
  activateRule: (ruleId: string) => Promise<void>;
  /** Deactivate an active rule (callers gate this behind the impact confirm). */
  deactivateRule: (ruleId: string) => Promise<void>;
}

/**
 * Build the rule activate/deactivate actions, each logging an undo entry and an
 * audit-trail record and reloading the rule list on success.
 *
 * @param options - See {@link UseRuleLifecycleOptions}.
 * @returns `{ activateRule, deactivateRule }`.
 */
export function useRuleLifecycle({
  targetTabId,
  rules,
  reload,
  onError,
}: UseRuleLifecycleOptions): UseRuleLifecycleReturn {
  const runLifecycle = useCallback(
    async (ruleId: string, kind: LifecycleKind) => {
      if (!targetTabId) return;

      const cfg = LIFECYCLE[kind];
      const startTime = Date.now();
      let currentUserEmail = 'unknown@unknown.com';

      try {
        log.debug(`${cfg.gerund} rule:`, ruleId);

        // Get current user for audit logging
        try {
          const userResponse = await chrome.tabs.sendMessage(targetTabId, {
            action: 'makeApiRequest',
            endpoint: '/api/v1/users/me',
            method: 'GET',
          });
          if (userResponse.success && userResponse.data) {
            currentUserEmail = userResponse.data.profile?.email || 'unknown@unknown.com';
          }
        } catch (err) {
          log.error('Failed to get current user:', err);
        }

        // Find the rule to get its name for undo logging
        const rule = rules.find((r) => r.id === ruleId);
        const ruleName = rule?.name || 'Unknown Rule';
        const groupIds = rule?.groupIds || [];
        const groupNames = rule?.groupNames || [];

        const response = await chrome.tabs.sendMessage(targetTabId, {
          action: cfg.action,
          ruleId,
        });

        if (response.success) {
          // Log undo action
          await logAction(`${cfg.verbPast} rule: ${ruleName}`, {
            type: cfg.undoType,
            ruleId,
            ruleName,
          });

          // Log to audit trail (fire-and-forget)
          const auditEntry: AuditLogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            action: cfg.auditAction,
            groupId: groupIds[0] || 'multiple',
            groupName: groupNames.length > 0 ? groupNames.join(', ') : ruleName,
            performedBy: currentUserEmail,
            affectedUsers: [],
            result: 'success',
            details: {
              usersSucceeded: 0,
              usersFailed: 0,
              apiRequestCount: 1,
              durationMs: Date.now() - startTime,
            },
          };
          auditStore.logOperation(auditEntry).catch((err) => {
            log.error('Failed to log audit entry:', err);
          });

          // Reload rules to get updated status
          await reload();
        } else {
          onError(response.error || cfg.failMessage);

          // Log failure to audit trail
          const auditEntry: AuditLogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            action: cfg.auditAction,
            groupId: groupIds[0] || 'multiple',
            groupName: groupNames.length > 0 ? groupNames.join(', ') : ruleName,
            performedBy: currentUserEmail,
            affectedUsers: [],
            result: 'failed',
            details: {
              usersSucceeded: 0,
              usersFailed: 0,
              apiRequestCount: 1,
              durationMs: Date.now() - startTime,
              errorMessages: [response.error || 'Unknown error'],
            },
          };
          auditStore.logOperation(auditEntry).catch((err) => {
            log.error('Failed to log audit entry:', err);
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        onError(message || cfg.failMessage);
        log.error(cfg.errorLog, err);

        // Log error to audit trail
        const rule = rules.find((r) => r.id === ruleId);
        const groupIds = rule?.groupIds || [];
        const groupNames = rule?.groupNames || [];
        const auditEntry: AuditLogEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: cfg.auditAction,
          groupId: groupIds[0] || 'unknown',
          groupName: groupNames.length > 0 ? groupNames.join(', ') : 'Unknown',
          performedBy: currentUserEmail,
          affectedUsers: [],
          result: 'failed',
          details: {
            usersSucceeded: 0,
            usersFailed: 0,
            apiRequestCount: 1,
            durationMs: Date.now() - startTime,
            errorMessages: [message || 'Unknown error'],
          },
        };
        auditStore.logOperation(auditEntry).catch((e) => {
          log.error('Failed to log audit entry:', e);
        });
      }
    },
    [targetTabId, rules, reload, onError],
  );

  const activateRule = useCallback(
    (ruleId: string) => runLifecycle(ruleId, 'activate'),
    [runLifecycle],
  );
  const deactivateRule = useCallback(
    (ruleId: string) => runLifecycle(ruleId, 'deactivate'),
    [runLifecycle],
  );

  return { activateRule, deactivateRule };
}
