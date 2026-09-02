/**
 * @module sidepanel/hooks/useRuleLifecycle
 * @description Activate/deactivate a group rule, with undo + audit logging.
 *
 * Extracted from `RulesTab` during its §7 decomposition. The two flows were
 * near-identical ~120-line blocks; they are unified here behind one
 * `runLifecycle(ruleId, kind)` while preserving the exact audit-entry shape,
 * undo metadata, current-user attribution, and post-mutation reload behavior.
 *
 * @remarks §8: routes through the rate-limited scheduler path — the current-user
 * lookup via the facade's `getCurrentUser()` and the mutation via
 * `activateGroupRule`/`deactivateGroupRule` (both `useOktaApi` ops that post
 * through the background `ApiScheduler`). No direct `chrome.tabs.sendMessage`.
 *
 * Audit attribution comes from `coreApi.getCurrentUser()` — the validated,
 * per-tab-cached lookup — and is written verbatim: a resolved admin's email, or
 * `performedBy: null` with `actorResolution: 'unavailable'`. There is no
 * placeholder identity, and an unresolved actor never blocks the rule change
 * (`D-013`/`D-013b`). When it is unresolved the hook also raises
 * {@link UseRuleLifecycleReturn.actorNotice} so the admin is told at the time
 * rather than discovering the gap in a later export (`D-013c`).
 *
 * ## Cache
 *
 * Activating or deactivating a rule changes both that rule's cached `status` and
 * the org-wide snapshot's active/inactive totals. This hook makes no
 * invalidation call of its own: the write layer drops the snapshot as part of the
 * successful `activateGroupRule`/`deactivateGroupRule` write
 * ({@link module:hooks/useOktaApi/ruleWrites}, ADR-0064). Before that, this was
 * the one rule-write path that had never remembered to (`D-095`), which is the
 * whole argument for putting the effect under the write instead of above it.
 */

import { useCallback } from 'react';
import type { FormattedRule, AuditLogEntry } from '../../shared/types';
import type { Actor } from './useOktaApi/core';
import type { AlertMessageData } from '../components/shared/AlertMessage';
import { logAction } from '../../shared/undoManager';
import { auditStore } from '../../shared/storage/auditStore';
import { createLogger } from '../../shared/utils/logger';
import { useOktaApi } from './useOktaApi';
import { useActorNotice } from './useActorNotice';

const log = createLogger('RulesTab');

/** Which lifecycle transition to run. */
type LifecycleKind = 'activate' | 'deactivate';

/** Per-kind copy/action wiring, keeping the two flows byte-faithful to the original. */
const LIFECYCLE = {
  activate: {
    auditAction: 'activate_rule' as const,
    undoType: 'ACTIVATE_RULE' as const,
    gerund: 'Activating',
    verbPast: 'Activated',
    failMessage: 'Failed to activate rule',
    errorLog: 'Activation error:',
  },
  deactivate: {
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
  /**
   * Non-blocking notice shown when the last run could not name the acting admin,
   * or `null` when it could. The rule change happens either way (`D-013c`).
   */
  actorNotice: AlertMessageData | null;
  /** Dismiss {@link UseRuleLifecycleReturn.actorNotice}. */
  dismissActorNotice: () => void;
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
  // §8: own a useOktaApi slice so both the current-user lookup and the mutation
  // route through the rate-limited scheduler instead of a direct content call.
  const { getCurrentUser, activateGroupRule, deactivateGroupRule } = useOktaApi({
    targetTabId: targetTabId ?? null,
  });
  const { actorNotice, noteActor, dismissActorNotice } = useActorNotice();

  const runLifecycle = useCallback(
    async (ruleId: string, kind: LifecycleKind) => {
      if (!targetTabId) return;

      const cfg = LIFECYCLE[kind];
      const startTime = Date.now();
      /**
       * The acting admin, or `null` if the lookup had not run yet when the
       * catch below built its entry. `getCurrentUser` reports its own failures
       * as `kind: 'unavailable'` and never throws, so every audit entry below
       * records what we actually knew.
       */
      let actor: Actor | null = null;

      try {
        log.debug(`${cfg.gerund} rule:`, ruleId);

        // Resolve the acting admin for audit attribution (validated + per-tab
        // cached inside the facade; no placeholder identity on failure).
        actor = await getCurrentUser();
        // Tell the admin their identity could not be confirmed, then carry on:
        // the notice is informational and never gates the mutation (`D-013c`).
        noteActor(actor);

        // Find the rule to get its name for undo logging
        const rule = rules.find((r) => r.id === ruleId);
        const ruleName = rule?.name || 'Unknown Rule';
        const groupIds = rule?.groupIds || [];
        const groupNames = rule?.groupNames || [];

        const response = await (kind === 'activate'
          ? activateGroupRule(ruleId)
          : deactivateGroupRule(ruleId));

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
            performedBy: actor?.kind === 'resolved' ? actor.email : null,
            actorResolution: actor?.kind === 'resolved' ? 'resolved' : 'unavailable',
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
            performedBy: actor?.kind === 'resolved' ? actor.email : null,
            actorResolution: actor?.kind === 'resolved' ? 'resolved' : 'unavailable',
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
          performedBy: actor?.kind === 'resolved' ? actor.email : null,
          actorResolution: actor?.kind === 'resolved' ? 'resolved' : 'unavailable',
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
    [
      targetTabId,
      rules,
      reload,
      onError,
      getCurrentUser,
      noteActor,
      activateGroupRule,
      deactivateGroupRule,
    ],
  );

  const activateRule = useCallback(
    (ruleId: string) => runLifecycle(ruleId, 'activate'),
    [runLifecycle],
  );
  const deactivateRule = useCallback(
    (ruleId: string) => runLifecycle(ruleId, 'deactivate'),
    [runLifecycle],
  );

  return { activateRule, deactivateRule, actorNotice, dismissActorNotice };
}
