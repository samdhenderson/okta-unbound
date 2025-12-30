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

  // Enhanced Venn diagram visualization for 2-3 groups
  const renderVennDiagram = () => {
    if (!comparison || comparison.groupData.length < 2 || comparison.groupData.length > 3) return null;

    if (comparison.groupData.length === 2) {
      return renderTwoGroupVenn();
    } else if (comparison.groupData.length === 3) {
      return renderThreeGroupVenn();
    }
    return null;
  };

  // Venn diagram for 2 groups
  const renderTwoGroupVenn = () => {
    const overlap = comparison.overlaps[0];
    const group1 = comparison.groupData[0];
    const group2 = comparison.groupData[1];

    const colors = {
      group1: { fill: 'rgba(59, 130, 246, 0.4)', stroke: 'rgb(37, 99, 235)', light: 'rgba(59, 130, 246, 0.15)' },
      group2: { fill: 'rgba(139, 92, 246, 0.4)', stroke: 'rgb(124, 58, 237)', light: 'rgba(139, 92, 246, 0.15)' },
      overlap: { fill: 'rgba(99, 102, 241, 0.6)', light: 'rgba(99, 102, 241, 0.2)' },
    };

    return (
      <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg border border-gray-200 p-8 shadow-sm">
        <h4 className="text-base font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-[#007dc1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Membership Overlap Visualization
        </h4>

        <svg viewBox="0 0 500 300" className="w-full h-auto" style={{ maxHeight: '320px' }}>
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
              <feOffset dx="0" dy="2" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.2"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Group 1 Circle */}
          <g className="cursor-pointer transition-opacity hover:opacity-90" filter="url(#shadow)">
            <circle
              cx="170"
              cy="150"
              r="95"
              fill={colors.group1.fill}
              stroke={colors.group1.stroke}
              strokeWidth="3"
            />
          </g>

          {/* Group 2 Circle */}
          <g className="cursor-pointer transition-opacity hover:opacity-90" filter="url(#shadow)">
            <circle
              cx="330"
              cy="150"
              r="95"
              fill={colors.group2.fill}
              stroke={colors.group2.stroke}
              strokeWidth="3"
            />
          </g>

          {/* Count Labels with backgrounds */}
          {overlap.uniqueToGroup1 > 0 && (
            <g>
              <circle cx="120" cy="150" r="28" fill="white" opacity="0.95" stroke={colors.group1.stroke} strokeWidth="1"/>
              <text x="120" y="150" textAnchor="middle" dominantBaseline="middle" className="text-lg font-bold" fill={colors.group1.stroke}>
                {overlap.uniqueToGroup1}
              </text>
              <text x="120" y="170" textAnchor="middle" className="text-xs" fill="#6b7280">
                unique
              </text>
            </g>
          )}

          {overlap.sharedUsers > 0 && (
            <g>
              <circle cx="250" cy="150" r="32" fill="white" opacity="0.95" stroke={colors.overlap.fill} strokeWidth="1.5"/>
              <text x="250" y="150" textAnchor="middle" dominantBaseline="middle" className="text-xl font-bold" fill="#4f46e5">
                {overlap.sharedUsers}
              </text>
              <text x="250" y="172" textAnchor="middle" className="text-xs font-semibold" fill="#4f46e5">
                shared
              </text>
            </g>
          )}

          {overlap.uniqueToGroup2 > 0 && (
            <g>
              <circle cx="380" cy="150" r="28" fill="white" opacity="0.95" stroke={colors.group2.stroke} strokeWidth="1"/>
              <text x="380" y="150" textAnchor="middle" dominantBaseline="middle" className="text-lg font-bold" fill={colors.group2.stroke}>
                {overlap.uniqueToGroup2}
              </text>
              <text x="380" y="170" textAnchor="middle" className="text-xs" fill="#6b7280">
                unique
              </text>
            </g>
          )}

          {/* Group Names */}
          <text x="170" y="35" textAnchor="middle" className="text-sm font-bold" fill={colors.group1.stroke}>
            {group1.name.length > 25 ? group1.name.substring(0, 25) + '...' : group1.name}
          </text>
          <text x="330" y="35" textAnchor="middle" className="text-sm font-bold" fill={colors.group2.stroke}>
            {group2.name.length > 25 ? group2.name.substring(0, 25) + '...' : group2.name}
          </text>

          {/* Total counts */}
          <text x="170" y="270" textAnchor="middle" className="text-xs" fill="#6b7280">
            Total: {group1.members.length}
          </text>
          <text x="330" y="270" textAnchor="middle" className="text-xs" fill="#6b7280">
            Total: {group2.members.length}
          </text>
        </svg>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center p-3 bg-gradient-to-br from-blue-50 to-white rounded-lg border border-blue-200">
            <div className="text-2xl font-bold" style={{ color: colors.group1.stroke }}>{overlap.uniqueToGroup1}</div>
            <div className="text-xs text-gray-600 mt-1 text-center">Only in {group1.name.substring(0, 20)}{group1.name.length > 20 ? '...' : ''}</div>
          </div>
          <div className="flex flex-col items-center p-3 bg-gradient-to-br from-indigo-50 to-white rounded-lg border border-indigo-300 shadow-sm">
            <div className="text-2xl font-bold text-indigo-600">{overlap.sharedUsers}</div>
            <div className="text-xs text-gray-600 mt-1 font-semibold">In Both Groups</div>
          </div>
          <div className="flex flex-col items-center p-3 bg-gradient-to-br from-purple-50 to-white rounded-lg border border-purple-200">
            <div className="text-2xl font-bold" style={{ color: colors.group2.stroke }}>{overlap.uniqueToGroup2}</div>
            <div className="text-xs text-gray-600 mt-1 text-center">Only in {group2.name.substring(0, 20)}{group2.name.length > 20 ? '...' : ''}</div>
          </div>
        </div>
      </div>
    );
  };

  // Venn diagram for 3 groups
  const renderThreeGroupVenn = () => {
    const group1 = comparison.groupData[0];
    const group2 = comparison.groupData[1];
    const group3 = comparison.groupData[2];

    // Calculate intersections
    const members1 = new Set(group1.members.map((m: any) => m.id));
    const members2 = new Set(group2.members.map((m: any) => m.id));
    const members3 = new Set(group3.members.map((m: any) => m.id));

    const intersection12 = new Set([...members1].filter(x => members2.has(x)));
    const intersection13 = new Set([...members1].filter(x => members3.has(x)));
    const intersection23 = new Set([...members2].filter(x => members3.has(x)));
    const intersection123 = new Set([...members1].filter(x => members2.has(x) && members3.has(x)));

    const only1 = members1.size - intersection12.size - intersection13.size + intersection123.size;
    const only2 = members2.size - intersection12.size - intersection23.size + intersection123.size;
    const only3 = members3.size - intersection13.size - intersection23.size + intersection123.size;
    const only12 = intersection12.size - intersection123.size;
    const only13 = intersection13.size - intersection123.size;
    const only23 = intersection23.size - intersection123.size;
    const all3 = intersection123.size;

    const colors = {
      group1: { fill: 'rgba(59, 130, 246, 0.35)', stroke: 'rgb(37, 99, 235)' },
      group2: { fill: 'rgba(139, 92, 246, 0.35)', stroke: 'rgb(124, 58, 237)' },
      group3: { fill: 'rgba(236, 72, 153, 0.35)', stroke: 'rgb(219, 39, 119)' },
    };

    return (
      <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg border border-gray-200 p-8 shadow-sm">
        <h4 className="text-base font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-[#007dc1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Three-Way Membership Overlap
        </h4>

        <svg viewBox="0 0 500 350" className="w-full h-auto" style={{ maxHeight: '380px' }}>
          <defs>
            <filter id="shadow3" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
              <feOffset dx="0" dy="2" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.2"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Three overlapping circles */}
          <g filter="url(#shadow3)">
            <circle cx="200" cy="140" r="90" fill={colors.group1.fill} stroke={colors.group1.stroke} strokeWidth="2.5" />
            <circle cx="300" cy="140" r="90" fill={colors.group2.fill} stroke={colors.group2.stroke} strokeWidth="2.5" />
            <circle cx="250" cy="225" r="90" fill={colors.group3.fill} stroke={colors.group3.stroke} strokeWidth="2.5" />
          </g>

          {/* Labels */}
          {only1 > 0 && (
            <g>
              <circle cx="145" cy="110" r="20" fill="white" opacity="0.95" />
              <text x="145" y="115" textAnchor="middle" className="text-sm font-bold" fill={colors.group1.stroke}>{only1}</text>
            </g>
          )}
          {only2 > 0 && (
            <g>
              <circle cx="355" cy="110" r="20" fill="white" opacity="0.95" />
              <text x="355" y="115" textAnchor="middle" className="text-sm font-bold" fill={colors.group2.stroke}>{only2}</text>
            </g>
          )}
          {only3 > 0 && (
            <g>
              <circle cx="250" cy="290" r="20" fill="white" opacity="0.95" />
              <text x="250" y="295" textAnchor="middle" className="text-sm font-bold" fill={colors.group3.stroke}>{only3}</text>
            </g>
          )}
          {only12 > 0 && (
            <g>
              <circle cx="250" cy="115" r="18" fill="white" opacity="0.95" />
              <text x="250" y="120" textAnchor="middle" className="text-xs font-bold" fill="#4f46e5">{only12}</text>
            </g>
          )}
          {only13 > 0 && (
            <g>
              <circle cx="190" cy="205" r="18" fill="white" opacity="0.95" />
              <text x="190" y="210" textAnchor="middle" className="text-xs font-bold" fill="#4f46e5">{only13}</text>
            </g>
          )}
          {only23 > 0 && (
            <g>
              <circle cx="310" cy="205" r="18" fill="white" opacity="0.95" />
              <text x="310" y="210" textAnchor="middle" className="text-xs font-bold" fill="#4f46e5">{only23}</text>
            </g>
          )}
          {all3 > 0 && (
            <g>
              <circle cx="250" cy="165" r="24" fill="white" opacity="0.95" stroke="#4f46e5" strokeWidth="1.5"/>
              <text x="250" y="170" textAnchor="middle" className="text-base font-bold" fill="#4f46e5">{all3}</text>
            </g>
          )}

          {/* Group names */}
          <text x="200" y="30" textAnchor="middle" className="text-xs font-bold" fill={colors.group1.stroke}>
            {group1.name.length > 18 ? group1.name.substring(0, 18) + '...' : group1.name}
          </text>
          <text x="300" y="30" textAnchor="middle" className="text-xs font-bold" fill={colors.group2.stroke}>
            {group2.name.length > 18 ? group2.name.substring(0, 18) + '...' : group2.name}
          </text>
          <text x="250" y="338" textAnchor="middle" className="text-xs font-bold" fill={colors.group3.stroke}>
            {group3.name.length > 18 ? group3.name.substring(0, 18) + '...' : group3.name}
          </text>
        </svg>

        <div className="mt-6 grid grid-cols-4 gap-2">
          <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
            <div className="text-lg font-bold text-blue-700">{only1}</div>
            <div className="text-xs text-gray-600">Only 1</div>
          </div>
          <div className="text-center p-2 bg-purple-50 rounded border border-purple-200">
            <div className="text-lg font-bold text-purple-700">{only2}</div>
            <div className="text-xs text-gray-600">Only 2</div>
          </div>
          <div className="text-center p-2 bg-pink-50 rounded border border-pink-200">
            <div className="text-lg font-bold text-pink-700">{only3}</div>
            <div className="text-xs text-gray-600">Only 3</div>
          </div>
          <div className="text-center p-2 bg-indigo-50 rounded border border-indigo-300 shadow-sm">
            <div className="text-lg font-bold text-indigo-600">{all3}</div>
            <div className="text-xs text-indigo-600 font-semibold">All 3</div>
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
