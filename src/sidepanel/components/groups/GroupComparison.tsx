import React, { useState } from 'react';

interface GroupComparisonProps {
  selectedGroupIds: string[];
  onCompare: (groupIds: string[]) => Promise<any>;
}

const GroupComparison: React.FC<GroupComparisonProps> = ({
  selectedGroupIds,
  onCompare,
}) => {
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (selectedGroupIds.length < 2) {
      setError('Please select at least 2 groups to compare');
      return;
    }

    if (selectedGroupIds.length > 5) {
      setError('Please select no more than 5 groups to compare');
      return;
    }

    setComparing(true);
    setError(null);
    setComparison(null);

    try {
      const result = await onCompare(selectedGroupIds);
      setComparison(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare groups');
    } finally {
      setComparing(false);
    }
  };

  const exportComparison = () => {
    if (!comparison) return;

    // Create CSV content
    let csv = 'Group Comparison Report\n\n';
    csv += 'Summary\n';
    csv += `Total Groups,${comparison.totalGroups}\n`;
    csv += `Total Unique Users,${comparison.totalUniqueUsers}\n\n`;

    csv += 'Group Details\n';
    csv += 'Group Name,Member Count\n';
    comparison.groupData?.forEach((g: any) => {
      csv += `"${g.name}",${g.members.length}\n`;
    });

    csv += '\nGroup Overlaps\n';
    csv += 'Group 1,Group 2,Shared Users,Unique to Group 1,Unique to Group 2\n';
    comparison.overlaps?.forEach((o: any) => {
      csv += `"${o.group1.name}","${o.group2.name}",${o.sharedUsers},${o.uniqueToGroup1},${o.uniqueToGroup2}\n`;
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `group-comparison-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Simple Venn diagram visualization for 2 groups
  const renderVennDiagram = () => {
    if (!comparison || comparison.groupData.length !== 2) return null;

    const overlap = comparison.overlaps[0];
    const group1 = comparison.groupData[0];
    const group2 = comparison.groupData[1];

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <svg viewBox="0 0 400 250" className="w-full h-auto">
          {/* Group 1 Circle */}
          <circle
            cx="140"
            cy="125"
            r="80"
            fill="rgba(59, 130, 246, 0.3)"
            stroke="rgb(59, 130, 246)"
            strokeWidth="2"
          />
          {/* Group 2 Circle */}
          <circle
            cx="260"
            cy="125"
            r="80"
            fill="rgba(139, 92, 246, 0.3)"
            stroke="rgb(139, 92, 246)"
            strokeWidth="2"
          />

          {/* Labels */}
          <text x="100" y="125" textAnchor="middle" className="text-sm font-semibold fill-gray-900">
            {overlap.uniqueToGroup1}
          </text>
          <text x="200" y="125" textAnchor="middle" className="text-sm font-semibold fill-gray-900">
            {overlap.sharedUsers}
          </text>
          <text x="300" y="125" textAnchor="middle" className="text-sm font-semibold fill-gray-900">
            {overlap.uniqueToGroup2}
          </text>

          {/* Group Names */}
          <text x="140" y="30" textAnchor="middle" className="text-xs font-bold fill-gray-700">
            {group1.name}
          </text>
          <text x="260" y="30" textAnchor="middle" className="text-xs font-bold fill-gray-700">
            {group2.name}
          </text>
        </svg>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(59, 130, 246, 0.5)' }}></span>
            <span className="text-sm text-gray-700">Unique to {group1.name}: <span className="font-semibold">{overlap.uniqueToGroup1}</span></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(139, 92, 246, 0.5)' }}></span>
            <span className="text-sm text-gray-700">Unique to {group2.name}: <span className="font-semibold">{overlap.uniqueToGroup2}</span></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(99, 111, 246, 0.5)' }}></span>
            <span className="text-sm text-gray-700">Shared: <span className="font-semibold">{overlap.sharedUsers}</span></span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Group Comparison</h3>
        <p className="text-sm text-gray-600">
          Compare 2-5 groups to see overlapping members and unique users.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Selected:</span>
            <span className="text-lg font-bold text-gray-900">
              {selectedGroupIds.length} group{selectedGroupIds.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={handleCompare}
            disabled={comparing || selectedGroupIds.length < 2 || selectedGroupIds.length > 5}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {comparing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Comparing...
              </span>
            ) : (
              'Compare Groups'
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-6">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-gray-900">Comparison Results</h4>
            <button
              onClick={exportComparison}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all duration-200"
            >
              Export Report
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="text-sm text-gray-600 mb-1">Total Groups</div>
              <div className="text-2xl font-bold text-gray-900">{comparison.totalGroups}</div>
            </div>
            <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="text-sm text-gray-600 mb-1">Total Unique Users</div>
              <div className="text-2xl font-bold text-gray-900">{comparison.totalUniqueUsers}</div>
            </div>
            <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="text-sm text-gray-600 mb-1">Avg Group Size</div>
              <div className="text-2xl font-bold text-gray-900">
                {Math.round(
                  comparison.groupData?.reduce((sum: number, g: any) => sum + g.members.length, 0) /
                    comparison.totalGroups
                )}
              </div>
            </div>
          </div>

          {/* Venn Diagram */}
          {comparison.groupData?.length === 2 && renderVennDiagram()}

          {/* Group Details Table */}
          <div className="space-y-3">
            <h4 className="text-base font-semibold text-gray-900">Group Details</h4>
            <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">Group Name</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">Member Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {comparison.groupData?.map((group: any) => (
                    <tr key={group.id} className="hover:bg-gray-50/50 transition-colors duration-150">
                      <td className="px-4 py-3 text-sm text-gray-900">{group.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          {group.type?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{group.members.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overlaps Table */}
          <div className="space-y-3">
            <h4 className="text-base font-semibold text-gray-900">Group Overlaps</h4>
            <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">Group 1</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">Group 2</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">Shared Users</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">Unique to Group 1</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">Unique to Group 2</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {comparison.overlaps?.map((overlap: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors duration-150">
                      <td className="px-4 py-3 text-sm text-gray-900">{overlap.group1.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{overlap.group2.name}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#007dc1]">{overlap.sharedUsers}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{overlap.uniqueToGroup1}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{overlap.uniqueToGroup2}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupComparison;
