/**
 * @module sidepanel/hooks/useRuleImpact
 * @description Owns the read-only rule-impact-preview flow for the Rules tab.
 *
 * Drives a single {@link RuleImpactModal}: which rule is being examined, whether
 * the intent is a plain preview or a deactivation confirmation, and the async
 * status of capturing the impact summary. Keeping this here keeps `RulesTab`
 * focused on rule loading/mutation.
 */

import { useCallback, useRef, useState } from 'react';
import type { RuleImpactSummary } from '../../shared/membership/ruleImpact';
import type { RuleImpactInput } from './useOktaApi/ruleImpact';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('useRuleImpact');

/** Why the impact modal is open: a read-only look, or a deactivation gate. */
export type RuleImpactMode = 'preview' | 'deactivate';

/** Lifecycle of the impact capture. */
export type RuleImpactStatus = 'idle' | 'loading' | 'done' | 'error';

/** Progress of the target-group member load. */
export interface RuleImpactProgress {
  current: number;
  total: number;
  message: string;
}

/** The capture function this hook drives (from `useOktaApi`). */
type CaptureRuleImpact = (
  rule: RuleImpactInput,
  opts?: { onProgress?: (current: number, total: number, message: string) => void },
) => Promise<RuleImpactSummary>;

/** Return shape of {@link useRuleImpact}. */
export interface UseRuleImpactReturn {
  /** The rule currently under examination, or null when the modal is closed. */
  rule: RuleImpactInput | null;
  /** Preview vs deactivation-confirmation intent. */
  mode: RuleImpactMode;
  /** Async status of the capture. */
  status: RuleImpactStatus;
  /** The captured summary once `status === 'done'`. */
  summary: RuleImpactSummary | null;
  /** Human-readable error when `status === 'error'`. */
  error: string | null;
  /** Load progress while `status === 'loading'`. */
  progress: RuleImpactProgress | null;
  /** Open the modal for a rule and immediately capture its impact. */
  open: (rule: RuleImpactInput, mode: RuleImpactMode) => void;
  /** Close the modal and reset state. */
  close: () => void;
}

/**
 * Manage the rule-impact-preview modal lifecycle.
 *
 * @param captureRuleImpact - The read-only capture operation from `useOktaApi`.
 * @returns State and `open`/`close` controls for a {@link RuleImpactModal}.
 */
export function useRuleImpact(captureRuleImpact: CaptureRuleImpact): UseRuleImpactReturn {
  const [rule, setRule] = useState<RuleImpactInput | null>(null);
  const [mode, setMode] = useState<RuleImpactMode>('preview');
  const [status, setStatus] = useState<RuleImpactStatus>('idle');
  const [summary, setSummary] = useState<RuleImpactSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<RuleImpactProgress | null>(null);

  // Guards against a stale capture (e.g. reopened for another rule) writing state.
  const runIdRef = useRef(0);

  const open = useCallback(
    (nextRule: RuleImpactInput, nextMode: RuleImpactMode) => {
      const runId = ++runIdRef.current;
      setRule(nextRule);
      setMode(nextMode);
      setStatus('loading');
      setSummary(null);
      setError(null);
      setProgress({ current: 0, total: nextRule.groupIds.length, message: 'Starting analysis…' });

      captureRuleImpact(nextRule, {
        onProgress: (current, total, message) => {
          if (runId === runIdRef.current) setProgress({ current, total, message });
        },
      })
        .then((result) => {
          if (runId !== runIdRef.current) return;
          setSummary(result);
          setStatus('done');
          setProgress(null);
        })
        .catch((err) => {
          if (runId !== runIdRef.current) return;
          log.error('Failed to capture rule impact:', err);
          setError(err instanceof Error ? err.message : 'Failed to analyze rule impact');
          setStatus('error');
          setProgress(null);
        });
    },
    [captureRuleImpact],
  );

  const close = useCallback(() => {
    runIdRef.current++;
    setRule(null);
    setStatus('idle');
    setSummary(null);
    setError(null);
    setProgress(null);
  }, []);

  return { rule, mode, status, summary, error, progress, open, close };
}
