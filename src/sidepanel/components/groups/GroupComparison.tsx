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
      <div className="venn-diagram">
        <svg viewBox="0 0 400 250" className="venn-svg">
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
          <text x="100" y="125" textAnchor="middle" className="venn-label">
            {overlap.uniqueToGroup1}
          </text>
          <text x="200" y="125" textAnchor="middle" className="venn-label">
            {overlap.sharedUsers}
          </text>
          <text x="300" y="125" textAnchor="middle" className="venn-label">
            {overlap.uniqueToGroup2}
          </text>

          {/* Group Names */}
          <text x="140" y="30" textAnchor="middle" className="venn-title">
            {group1.name}
          </text>
          <text x="260" y="30" textAnchor="middle" className="venn-title">
            {group2.name}
          </text>
        </svg>

        <div className="venn-legend">
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: 'rgba(59, 130, 246, 0.5)' }}></span>
            Unique to {group1.name}: {overlap.uniqueToGroup1}
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: 'rgba(139, 92, 246, 0.5)' }}></span>
            Unique to {group2.name}: {overlap.uniqueToGroup2}
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: 'rgba(99, 111, 246, 0.5)' }}></span>
            Shared: {overlap.sharedUsers}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="group-comparison">
      <h3>Group Comparison</h3>
      <p className="section-description">
        Compare 2-5 groups to see overlapping members and unique users.
      </p>

      <div className="comparison-controls">
        <div className="selected-count">
          Selected: {selectedGroupIds.length} group{selectedGroupIds.length !== 1 ? 's' : ''}
        </div>
        <button
          className="btn-primary"
          onClick={handleCompare}
          disabled={comparing || selectedGroupIds.length < 2 || selectedGroupIds.length > 5}
        >
          {comparing ? 'Comparing...' : 'Compare Groups'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {comparison && (
        <div className="comparison-results">
          <div className="comparison-header">
            <h4>Comparison Results</h4>
            <button className="btn-secondary" onClick={exportComparison}>
              Export Report
            </button>
          </div>

          <div className="comparison-summary">
            <div className="summary-card">
              <div className="summary-label">Total Groups</div>
              <div className="summary-value">{comparison.totalGroups}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Total Unique Users</div>
              <div className="summary-value">{comparison.totalUniqueUsers}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Avg Group Size</div>
              <div className="summary-value">
                {Math.round(
                  comparison.groupData?.reduce((sum: number, g: any) => sum + g.members.length, 0) /
                    comparison.totalGroups
                )}
              </div>
            </div>
          </div>

          {comparison.groupData?.length === 2 && renderVennDiagram()}

          <div className="groups-table">
            <h4>Group Details</h4>
            <table>
              <thead>
                <tr>
                  <th>Group Name</th>
                  <th>Type</th>
                  <th>Member Count</th>
                </tr>
              </thead>
              <tbody>
                {comparison.groupData?.map((group: any) => (
                  <tr key={group.id}>
                    <td>{group.name}</td>
                    <td>
                      <span className="badge badge-primary">
                        {group.type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{group.members.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overlaps-table">
            <h4>Group Overlaps</h4>
            <table>
              <thead>
                <tr>
                  <th>Group 1</th>
                  <th>Group 2</th>
                  <th>Shared Users</th>
                  <th>Unique to Group 1</th>
                  <th>Unique to Group 2</th>
                </tr>
              </thead>
              <tbody>
                {comparison.overlaps?.map((overlap: any, idx: number) => (
                  <tr key={idx}>
                    <td>{overlap.group1.name}</td>
                    <td>{overlap.group2.name}</td>
                    <td className="highlight">{overlap.sharedUsers}</td>
                    <td>{overlap.uniqueToGroup1}</td>
                    <td>{overlap.uniqueToGroup2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupComparison;
