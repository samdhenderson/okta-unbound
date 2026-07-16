/**
 * @module sidepanel/components/RuleConsolidationModal
 * @description Wizard for rule consolidation (Feature A4).
 *
 * Add-target flow: search-select a group to add → dry-run diff → confirm. Merge
 * flow: opens straight to the diff for a cluster of identical-expression rules.
 * The confirm step creates the union rule, activates it if needed, then retires
 * the source rule(s). All writes are audited and captured for undo.
 */
import React, { useCallback, useRef, useState } from 'react';
import Modal from './shared/Modal';
import Button from './shared/Button';
import Input from './shared/Input';
import LoadingSpinner from './shared/LoadingSpinner';
import type {
  ConsolidationPhase,
  ConsolidationPreview,
  ConsolidationResult,
} from '../hooks/useRuleConsolidation';

/** A group search hit. */
type GroupHit = { id: string; name: string };

interface RuleConsolidationModalProps {
  phase: ConsolidationPhase;
  preview: ConsolidationPreview | null;
  result: ConsolidationResult | null;
  error: string | null;
  /** Search groups by name (add-target select step). */
  searchGroups: (query: string) => Promise<Array<{ id: string; name: string }>>;
  /** Choose the group to add. */
  onChooseGroup: (groupId: string, groupName: string) => void;
  /** Execute the consolidation. */
  onExecute: () => void;
  /** Close + reset. */
  onClose: () => void;
}

/** Renders the consolidation wizard across its phases. */
const RuleConsolidationModal: React.FC<RuleConsolidationModalProps> = ({
  phase,
  preview,
  result,
  error,
  searchGroups,
  onChooseGroup,
  onExecute,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<GroupHit[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQuery = useCallback(
    (value: string) => {
      setQuery(value);
      if (timer.current) clearTimeout(timer.current);
      if (value.trim().length < 2) {
        setHits([]);
        return;
      }
      timer.current = setTimeout(async () => {
        setSearching(true);
        try {
          setHits(await searchGroups(value.trim()));
        } finally {
          setSearching(false);
        }
      }, 300);
    },
    [searchGroups],
  );

  const isOpen = phase !== 'idle';
  const addedSet = new Set(preview?.addedGroupIds ?? []);

  const footer =
    phase === 'preview' ? (
      <>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onExecute}>
          Create &amp; retire
        </Button>
      </>
    ) : (
      <Button variant="secondary" onClick={onClose}>
        {phase === 'done' || phase === 'error' ? 'Close' : 'Cancel'}
      </Button>
    );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Consolidate rule" size="lg" footer={footer}>
      {phase === 'loading' && <LoadingSpinner size="md" centered message="Loading rule…" />}

      {/* Add-target: pick a group */}
      {phase === 'select' && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            Okta only sets target groups when a rule is created, so adding one creates a replacement
            rule (same condition, extra group) and retires the original. Pick the group to add:
          </p>
          <Input
            value={query}
            onChange={handleQuery}
            placeholder="Search groups by name…"
            autoFocus
          />
          {searching && <p className="text-xs text-neutral-500">Searching…</p>}
          <ul className="space-y-1.5 max-h-64 overflow-y-auto scrollable-list">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => onChooseGroup(hit.id, hit.name)}
                  className="w-full text-left rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 hover:border-primary hover:bg-primary-light transition-colors"
                >
                  {hit.name}
                </button>
              </li>
            ))}
            {query.trim().length >= 2 && !searching && hits.length === 0 && (
              <li className="text-sm text-neutral-500">No groups found.</li>
            )}
          </ul>
        </div>
      )}

      {/* Dry-run diff */}
      {phase === 'preview' && preview && (
        <div className="space-y-4">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
              New rule
            </div>
            <p className="text-sm font-medium text-neutral-900">{preview.resultingName}</p>
            <p className="text-xs text-neutral-500">
              {preview.willActivate ? 'Created active' : 'Created inactive'} · same condition as{' '}
              {preview.baseName}
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-2">
              Target groups ({preview.resultingGroupIds.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {preview.resultingGroupIds.map((id) => {
                const added = addedSet.has(id);
                return (
                  <span
                    key={id}
                    className={`px-2 py-0.5 rounded-md text-xs font-mono border ${
                      added
                        ? 'bg-success-light text-success-text border-success-light'
                        : 'bg-white text-neutral-600 border-neutral-200'
                    }`}
                  >
                    {added ? '+ ' : ''}
                    {preview.addedGroupNames[preview.addedGroupIds.indexOf(id)] || id}
                  </span>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-2">
              Will retire ({preview.retireRules.length})
            </div>
            <ul className="space-y-1.5">
              {preview.retireRules.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2"
                >
                  <span className="text-sm text-neutral-900 truncate">{r.name}</span>
                  <span className="text-xs text-neutral-500">{r.status}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-neutral-500">
            {preview.mode === 'merge'
              ? 'No access change: these rules share an identical condition, so the same users are matched — only the target groups are unioned.'
              : `Everyone this rule matches will also be added to ${preview.addedGroupNames[0] || 'the new group'}. Existing access is not removed.`}
          </p>
          <p className="text-xs text-neutral-400">
            Source rules are deleted only after the new rule is created (and activated). Their
            definitions are captured in History for undo.
          </p>
        </div>
      )}

      {phase === 'running' && (
        <LoadingSpinner size="md" centered message="Creating the new rule and retiring the old…" />
      )}

      {phase === 'error' && (
        <p className="text-sm text-danger-text">{error || 'Consolidation failed.'}</p>
      )}

      {phase === 'done' && result && (
        <div className="space-y-2">
          <p className="text-sm text-success-text font-medium">Created {result.createdRuleName}.</p>
          <p className="text-sm text-neutral-600">
            Retired {result.retired} source rule{result.retired === 1 ? '' : 's'}
            {result.retireFailed > 0 ? ` (${result.retireFailed} failed to delete)` : ''}.
          </p>
        </div>
      )}
    </Modal>
  );
};

export default RuleConsolidationModal;
