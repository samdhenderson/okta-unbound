/**
 * @module sidepanel/hooks/useRuleConsolidation
 * @description Drives the rule-consolidation flow (Feature A4).
 *
 * Okta only sets a rule's target groups at creation, so both supported
 * operations — "add a target group" and "merge identical-expression rules" —
 * reduce to the same safe sequence: **create** a replacement rule carrying the
 * union of target groups, **activate** it (if any source was active), and only
 * then **retire** (delete) the source rule(s). If the create or activate step
 * fails, no source is touched. Every run is audited (attributed to the signed-in
 * admin resolved via `/api/v1/users/me`) and captures the retired rules'
 * definitions for undo.
 */

import { useCallback, useState } from 'react';
import type { FormattedRule, OktaGroupRule, AuditLogEntry } from '../../shared/types';
import type { RetiredRuleSnapshot } from '../../shared/undoTypes';
import { useOktaApi } from './useOktaApi';
import { logAction } from '../../shared/undoManager';
import { auditStore } from '../../shared/storage/auditStore';
import {
  buildConsolidatedRulePayload,
  consolidatedRuleName,
  unionTargetGroups,
} from '../../shared/rules/consolidation';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('useRuleConsolidation');

/** Lifecycle of the consolidation flow. */
export type ConsolidationPhase =
  'idle' | 'loading' | 'select' | 'preview' | 'running' | 'done' | 'error';

/** What is being consolidated. */
export type ConsolidationMode = 'add-target' | 'merge';

/** A source rule that will be retired, shown in the preview. */
export interface RetireRuleRef {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

/** The structural preview of the resulting consolidated rule. */
export interface ConsolidationPreview {
  mode: ConsolidationMode;
  /** Name of the rule being consolidated from (base). */
  baseName: string;
  /** The consolidated rule's resulting name. */
  resultingName: string;
  /** Target group ids the consolidated rule will carry. */
  resultingGroupIds: string[];
  /** Group ids being added relative to the base rule (add-target only). */
  addedGroupIds: string[];
  /** Display names for `addedGroupIds`, if known. */
  addedGroupNames: string[];
  /** Source rules that will be deleted after the new rule is live. */
  retireRules: RetireRuleRef[];
  /** Whether the new rule will be activated (a source was active). */
  willActivate: boolean;
}

/** Outcome of a consolidation run. */
export interface ConsolidationResult {
  createdRuleId: string;
  createdRuleName: string;
  retired: number;
  retireFailed: number;
}

/** Options for {@link useRuleConsolidation}. */
interface UseRuleConsolidationOptions {
  targetTabId?: number;
  /** Reload the rule list after a run. */
  reload: () => Promise<void>;
  /** Surface an error message in the tab. */
  onError: (message: string) => void;
}

/** Return shape of {@link useRuleConsolidation}. */
export interface UseRuleConsolidationReturn {
  phase: ConsolidationPhase;
  preview: ConsolidationPreview | null;
  result: ConsolidationResult | null;
  error: string | null;
  /** Open the "add target group" flow for a rule (loads its raw form). */
  openAddTarget: (rule: FormattedRule) => void;
  /** Choose the group to add (add-target flow), computing the preview. */
  chooseGroup: (groupId: string, groupName: string) => void;
  /** Open the "merge identical rules" flow for a cluster (base + all sources). */
  openMerge: (baseRuleId: string, cluster: RetireRuleRef[], unionGroupIds: string[]) => void;
  /** Execute the previewed consolidation. */
  execute: () => Promise<void>;
  /** Close + reset. */
  close: () => void;
}

/**
 * Manage the rule-consolidation wizard (add-target / merge).
 *
 * @param options - See {@link UseRuleConsolidationOptions}.
 * @returns Consolidation state plus its controls.
 */
export function useRuleConsolidation({
  targetTabId,
  reload,
  onError,
}: UseRuleConsolidationOptions): UseRuleConsolidationReturn {
  const api = useOktaApi({ targetTabId: targetTabId ?? null });
  const {
    getRawGroupRule,
    createGroupRule,
    deleteGroupRule,
    activateGroupRule,
    deactivateGroupRule,
    makeApiRequest,
  } = api;

  const [phase, setPhase] = useState<ConsolidationPhase>('idle');
  const [baseRule, setBaseRule] = useState<OktaGroupRule | null>(null);
  const [preview, setPreview] = useState<ConsolidationPreview | null>(null);
  const [result, setResult] = useState<ConsolidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openAddTarget = useCallback(
    (rule: FormattedRule) => {
      setPhase('loading');
      setPreview(null);
      setResult(null);
      setError(null);
      getRawGroupRule(rule.id)
        .then((raw) => {
          if (!raw) {
            setError('Could not load the rule to consolidate.');
            setPhase('error');
            return;
          }
          setBaseRule(raw);
          setPhase('select');
        })
        .catch((err) => {
          log.error('Failed to load rule:', err);
          setError(err instanceof Error ? err.message : 'Failed to load rule');
          setPhase('error');
        });
    },
    [getRawGroupRule],
  );

  const chooseGroup = useCallback(
    (groupId: string, groupName: string) => {
      if (!baseRule) return;
      const resultingGroupIds = unionTargetGroups(baseRule, [groupId]);
      setPreview({
        mode: 'add-target',
        baseName: baseRule.name,
        resultingName: consolidatedRuleName(baseRule.name),
        resultingGroupIds,
        addedGroupIds: [groupId],
        addedGroupNames: [groupName],
        retireRules: [{ id: baseRule.id, name: baseRule.name, status: baseRule.status }],
        willActivate: baseRule.status === 'ACTIVE',
      });
      setPhase('preview');
    },
    [baseRule],
  );

  const openMerge = useCallback(
    (baseRuleId: string, cluster: RetireRuleRef[], unionGroupIds: string[]) => {
      setPhase('loading');
      setPreview(null);
      setResult(null);
      setError(null);
      getRawGroupRule(baseRuleId)
        .then((raw) => {
          if (!raw) {
            setError('Could not load the primary rule to merge.');
            setPhase('error');
            return;
          }
          setBaseRule(raw);
          setPreview({
            mode: 'merge',
            baseName: raw.name,
            resultingName: consolidatedRuleName(raw.name),
            resultingGroupIds: unionGroupIds,
            addedGroupIds: [],
            addedGroupNames: [],
            retireRules: cluster,
            willActivate: cluster.some((r) => r.status === 'ACTIVE'),
          });
          setPhase('preview');
        })
        .catch((err) => {
          log.error('Failed to load primary rule:', err);
          setError(err instanceof Error ? err.message : 'Failed to load rule');
          setPhase('error');
        });
    },
    [getRawGroupRule],
  );

  const execute = useCallback(async () => {
    if (!baseRule || !preview) return;
    setPhase('running');
    setError(null);
    const startTime = Date.now();

    // Resolve the signed-in admin for audit attribution (same pattern as
    // useRuleLifecycle). Falls back to a labeled placeholder only if the
    // `/api/v1/users/me` lookup fails.
    let currentUserEmail = 'unknown@unknown.com';
    try {
      const userResponse = await makeApiRequest('/api/v1/users/me');
      if (userResponse.success && userResponse.data) {
        currentUserEmail = userResponse.data.profile?.email || 'unknown@unknown.com';
      }
    } catch (err) {
      log.error('Failed to get current user:', err);
    }

    try {
      // 1) Create the consolidated rule (INACTIVE). Nothing is retired if this fails.
      const addGroupIds =
        preview.mode === 'add-target' ? preview.addedGroupIds : preview.resultingGroupIds; // merge: union (dedup handled by builder)
      const payload = buildConsolidatedRulePayload(baseRule, addGroupIds);
      const created = await createGroupRule(payload);
      if (!created.success || !created.rule) {
        onError(created.error || 'Failed to create the consolidated rule');
        setError(created.error || 'Failed to create the consolidated rule');
        setPhase('error');
        return;
      }

      // 2) Activate it if any source was active. Abort before deleting on failure.
      if (preview.willActivate) {
        const activated = await activateGroupRule(created.rule.id);
        if (!activated.success) {
          const msg = `Created "${created.rule.name}" but could not activate it; source rules left untouched.`;
          onError(activated.error || msg);
          setError(activated.error || msg);
          setPhase('error');
          return;
        }
      }

      // 3) Retire (deactivate then delete) each source rule, capturing a snapshot.
      const retiredSnapshots: RetiredRuleSnapshot[] = [];
      let retired = 0;
      let retireFailed = 0;
      for (const ref of preview.retireRules) {
        const raw = ref.id === baseRule.id ? baseRule : await getRawGroupRule(ref.id);
        if (ref.status === 'ACTIVE') {
          await deactivateGroupRule(ref.id);
        }
        const del = await deleteGroupRule(ref.id);
        if (del.success) {
          retired++;
          if (raw) {
            retiredSnapshots.push({
              id: raw.id,
              name: raw.name,
              expression: raw.conditions?.expression?.value ?? '',
              groupIds: raw.actions?.assignUserToGroups?.groupIds ?? [],
            });
          }
        } else {
          retireFailed++;
        }
      }

      // 4) Audit + undo (captures retired definitions for restore).
      await logAction(
        `Consolidated ${preview.retireRules.length} rule${preview.retireRules.length === 1 ? '' : 's'} into ${created.rule.name}`,
        {
          type: 'CONSOLIDATE_RULE',
          createdRuleId: created.rule.id,
          createdRuleName: created.rule.name,
          createdGroupIds: preview.resultingGroupIds,
          retiredRules: retiredSnapshots,
        },
      );
      const auditEntry: AuditLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        action: 'activate_rule',
        groupId: preview.resultingGroupIds[0] || 'multiple',
        groupName: created.rule.name,
        performedBy: currentUserEmail,
        affectedUsers: [],
        result: retireFailed === 0 ? 'success' : 'partial',
        details: {
          usersSucceeded: retired,
          usersFailed: retireFailed,
          apiRequestCount: 2 + preview.retireRules.length,
          durationMs: Date.now() - startTime,
        },
      };
      auditStore.logOperation(auditEntry).catch((e) => log.error('audit failed', e));

      setResult({
        createdRuleId: created.rule.id,
        createdRuleName: created.rule.name,
        retired,
        retireFailed,
      });
      setPhase('done');
      await reload();
    } catch (err) {
      log.error('Consolidation failed:', err);
      const msg = err instanceof Error ? err.message : 'Consolidation failed';
      onError(msg);
      setError(msg);
      setPhase('error');
    }
  }, [
    baseRule,
    preview,
    createGroupRule,
    activateGroupRule,
    deactivateGroupRule,
    deleteGroupRule,
    getRawGroupRule,
    makeApiRequest,
    onError,
    reload,
  ]);

  const close = useCallback(() => {
    setPhase('idle');
    setBaseRule(null);
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  return { phase, preview, result, error, openAddTarget, chooseGroup, openMerge, execute, close };
}
