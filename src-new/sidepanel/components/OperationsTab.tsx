import React, { useState } from 'react';

interface OperationsTabProps {
  groupId?: string;
}

const OperationsTab: React.FC<OperationsTabProps> = ({ groupId }) => {
  const [results, setResults] = useState<Array<{ message: string; type: string }>>([]);

  const addResult = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setResults((prev) => [{ message, type }, ...prev]);
  };

  const handleRemoveDeprovisioned = () => {
    addResult('Remove deprovisioned operation - Coming soon!', 'info');
  };

  const handleSmartCleanup = () => {
    addResult('Smart cleanup operation - Coming soon!', 'info');
  };

  const handleCustomFilter = () => {
    addResult('Custom filter operation - Coming soon!', 'info');
  };

  const handleExport = () => {
    addResult('Export operation - Coming soon!', 'info');
  };

  const disabled = !groupId;

  return (
    <div className="tab-content active">
      {/* Quick Actions */}
      <div className="section">
        <h2>Quick Actions</h2>

        <div className="operation-card">
          <div className="operation-header">
            <h3>Remove Deprovisioned</h3>
            <span className="info-icon" data-tooltip="~1-5 fetch + 1 per removal">
              i
            </span>
          </div>
          <p>Remove deactivated users from group</p>
          <button
            className="btn btn-primary"
            onClick={handleRemoveDeprovisioned}
            disabled={disabled}
          >
            Run
          </button>
        </div>

        <div className="operation-card">
          <div className="operation-header">
            <h3>Smart Cleanup</h3>
            <span className="info-icon" data-tooltip="~1-5 fetch + 1 per inactive user">
              i
            </span>
          </div>
          <p>Remove all inactive users (deprovisioned, suspended, locked out)</p>
          <button className="btn btn-warning" onClick={handleSmartCleanup} disabled={disabled}>
            Run
          </button>
        </div>

        <div className="operation-card">
          <div className="operation-header">
            <h3>Custom Filter</h3>
            <span className="info-icon" data-tooltip="~1-5 fetch + 1 per removal">
              i
            </span>
          </div>
          <label htmlFor="statusFilter">Status:</label>
          <select id="statusFilter" className="input" disabled={disabled}>
            <option value="DEPROVISIONED">DEPROVISIONED</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="STAGED">STAGED</option>
            <option value="PROVISIONED">PROVISIONED</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="RECOVERY">RECOVERY</option>
            <option value="LOCKED_OUT">LOCKED_OUT</option>
            <option value="PASSWORD_EXPIRED">PASSWORD_EXPIRED</option>
          </select>
          <label htmlFor="action">Action:</label>
          <select id="action" className="input" disabled={disabled}>
            <option value="remove">Remove</option>
            <option value="list">List Only</option>
          </select>
          <button className="btn btn-primary" onClick={handleCustomFilter} disabled={disabled}>
            Execute
          </button>
        </div>

        <div className="operation-card">
          <div className="operation-header">
            <h3>Export Members</h3>
            <span className="info-icon" data-tooltip="~1-5 fetch (read-only)">
              i
            </span>
          </div>
          <label htmlFor="exportFormat">Format:</label>
          <select id="exportFormat" className="input" disabled={disabled}>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
          <label htmlFor="exportFilter">Filter (optional):</label>
          <select id="exportFilter" className="input" disabled={disabled}>
            <option value="">All Users</option>
            <option value="ACTIVE">ACTIVE Only</option>
            <option value="DEPROVISIONED">DEPROVISIONED Only</option>
            <option value="SUSPENDED">SUSPENDED Only</option>
            <option value="STAGED">STAGED Only</option>
          </select>
          <button className="btn btn-success" onClick={handleExport} disabled={disabled}>
            Export
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="section">
        <h2>Results</h2>
        <div className="results-box">
          {results.length === 0 ? (
            <p className="muted">No operations run yet</p>
          ) : (
            results.map((result, i) => (
              <div key={i} className={`result-item result-${result.type}`}>
                {result.message}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="section">
        <h2>Progress</h2>
        <div className="progress-container">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '0%' }}></div>
          </div>
          <p className="progress-text">Ready</p>
        </div>
      </div>
    </div>
  );
};

export default OperationsTab;
