import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import type { GroupSummary, GroupComparisonResult, OktaUser } from '../../../shared/types';

interface GroupComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: GroupSummary[];
  compareGroups: (
    groups: Array<{ id: string; name: string }>,
    onProgress?: (current: number, total: number, message?: string) => void,
    memberCache?: Map<string, OktaUser[]>
  ) => Promise<GroupComparisonResult>;
  memberCache: Map<string, OktaUser[]>;
}

const COLORS = ['text-primary-text', 'text-warning-text', 'text-success-text', 'text-danger-text', 'text-neutral-700'];
const BG_COLORS = ['bg-primary-light', 'bg-warning-light', 'bg-success-light', 'bg-danger-light', 'bg-neutral-50'];

const GroupComparisonModal: React.FC<GroupComparisonModalProps> = ({
  isOpen,
  onClose,
  groups,
  compareGroups,
  memberCache,
}) => {
  const [result, setResult] = useState<GroupComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const runComparison = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const comparison = await compareGroups(
        groups.map((g) => ({ id: g.id, name: g.name })),
        (_current, _total, message) => setProgress(message || ''),
        memberCache
      );
      setResult(comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setLoading(false);
      setProgress('');
    }
  }, [groups, compareGroups, memberCache]);

  useEffect(() => {
    if (isOpen && groups.length >= 2) {
      runComparison();
    }
    return () => {
      setResult(null);
      setError(null);
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportResults = useCallback(() => {
    if (!result) return;

    const rows: string[][] = [['Metric', 'Value']];
    rows.push(['Total Unique Users', String(result.totalUniqueUsers)]);
    rows.push(['Users in ALL Groups', String(result.intersection.length)]);

    for (const group of result.groups) {
      const unique = result.uniqueMembers[group.id]?.length || 0;
      rows.push([`${group.name} - Total Members`, String(group.memberCount)]);
      rows.push([`${group.name} - Unique Only`, String(unique)]);
    }

    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `group_comparison_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Group Comparison"
      size="xl"
      footer={
        result && (
          <>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button variant="primary" icon="download" onClick={handleExportResults}>Export Results</Button>
          </>
        )
      }
    >
      {loading && (
        <div className="text-center py-8 space-y-3">
          <div className="w-8 h-8 border-2 border-neutral-200 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-sm text-neutral-600">{progress || 'Loading group members...'}</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-danger-light text-danger-text rounded-md text-sm">{error}</div>
      )}

      {result && (
        <div className="space-y-5">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-neutral-50 rounded-md border border-neutral-200 text-center">
              <div className="text-2xl font-bold text-neutral-900">{result.totalUniqueUsers}</div>
              <div className="text-xs text-neutral-600 mt-0.5">Total Unique Users</div>
            </div>
            <div className="p-3 bg-primary-light rounded-md border border-primary-highlight text-center">
              <div className="text-2xl font-bold text-primary-text">{result.intersection.length}</div>
              <div className="text-xs text-primary-text mt-0.5">In All Groups</div>
            </div>
          </div>

          {/* Per-Group Breakdown */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Per-Group Breakdown</div>
            {result.groups.map((group, i) => {
              const uniqueCount = result.uniqueMembers[group.id]?.length || 0;
              const sharedCount = group.memberCount - uniqueCount;
              const overlapPct = group.memberCount > 0
                ? Math.round((sharedCount / group.memberCount) * 100)
                : 0;

              return (
                <div key={group.id} className={`p-3 rounded-md border border-neutral-200 ${BG_COLORS[i] || 'bg-neutral-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${COLORS[i] || 'text-neutral-900'}`}>{group.name}</span>
                    <span className="text-xs text-neutral-600">{group.memberCount} members</span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <div>
                      <span className="font-medium text-neutral-700">{uniqueCount}</span>
                      <span className="text-neutral-500 ml-1">unique</span>
                    </div>
                    <div>
                      <span className="font-medium text-neutral-700">{sharedCount}</span>
                      <span className="text-neutral-500 ml-1">shared</span>
                    </div>
                    <div>
                      <span className="font-medium text-neutral-700">{overlapPct}%</span>
                      <span className="text-neutral-500 ml-1">overlap</span>
                    </div>
                  </div>
                  {/* Overlap bar */}
                  <div className="mt-2 h-1.5 bg-white/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${overlapPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overlap Matrix */}
          {result.groups.length > 2 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Pairwise Overlap</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-neutral-600 font-medium"></th>
                      {result.groups.map((g, i) => (
                        <th key={g.id} className={`p-2 text-center font-medium ${COLORS[i]}`}>
                          {g.name.length > 15 ? g.name.slice(0, 15) + '...' : g.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.groups.map((rowGroup, ri) => (
                      <tr key={rowGroup.id}>
                        <td className={`p-2 font-medium ${COLORS[ri]}`}>
                          {rowGroup.name.length > 15 ? rowGroup.name.slice(0, 15) + '...' : rowGroup.name}
                        </td>
                        {result.groups.map((colGroup) => {
                          if (rowGroup.id === colGroup.id) {
                            return <td key={colGroup.id} className="p-2 text-center text-neutral-400">-</td>;
                          }
                          // Compute pairwise overlap from cache
                          const rowMembers = memberCache.get(rowGroup.id);
                          const colMembers = memberCache.get(colGroup.id);
                          let overlap = 0;
                          if (rowMembers && colMembers) {
                            const colSet = new Set(colMembers.map((u) => u.id));
                            overlap = rowMembers.filter((u) => colSet.has(u.id)).length;
                          }
                          return (
                            <td key={colGroup.id} className="p-2 text-center font-medium text-neutral-900">
                              {overlap}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default GroupComparisonModal;
