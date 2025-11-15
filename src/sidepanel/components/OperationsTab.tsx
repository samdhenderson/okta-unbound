import React, { useState } from 'react';
import { useOktaApi } from '../hooks/useOktaApi';
import type { UserStatus } from '../../shared/types';
import ConfirmationModal from './ConfirmationModal';

interface OperationsTabProps {
  groupId?: string;
  groupName?: string;
  targetTabId: number | null;
}

interface Result {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

const OperationsTab: React.FC<OperationsTabProps> = ({ groupId, groupName, targetTabId }) => {
  const [results, setResults] = useState<Result[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 100, message: 'Ready' });
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    apiCost: string;
    onConfirm: () => void;
  } | null>(null);

  // Form state
  const [statusFilter, setStatusFilter] = useState<UserStatus>('DEPROVISIONED');
  const [action, setAction] = useState<'list' | 'remove'>('remove');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exportFilter, setExportFilter] = useState<UserStatus | ''>('');

  const addResult = (message: string, type: Result['type'] = 'info') => {
    console.log('[OperationsTab] addResult:', { message, type });
    setResults((prev) => [{ message, type }, ...prev]);
  };

  const updateProgress = (current: number, total: number, message: string) => {
    console.log('[OperationsTab] updateProgress:', { current, total, message });
    setProgress({ current, total, message });
  };

  const api = useOktaApi({
    targetTabId,
    onResult: addResult,
    onProgress: updateProgress,
  });

  const disabled = !groupId || api.isLoading;

  const showConfirmation = (
    title: string,
    message: string,
    apiCost: string,
    onConfirm: () => void
  ) => {
    setModalState({ isOpen: true, title, message, apiCost, onConfirm });
  };

  const closeModal = () => {
    setModalState(null);
  };

  const handleRemoveDeprovisioned = () => {
    showConfirmation(
      'Remove Deprovisioned Users',
      'This will scan all group members and remove users with DEPROVISIONED status. This action cannot be undone.',
      'Fetch members: 1-5 requests\nRemove users: 1 per user\nTotal: Varies',
      () => {
        closeModal();
        if (groupId) api.removeDeprovisioned(groupId);
      }
    );
  };

  const handleSmartCleanup = () => {
    showConfirmation(
      'Smart Cleanup',
      'This will remove all inactive users (DEPROVISIONED, SUSPENDED, LOCKED_OUT) in one operation. This action cannot be undone.',
      'Fetch members: 1-5 requests\nRemove users: 1 per inactive user\nTotal: Varies',
      () => {
        closeModal();
        if (groupId) api.smartCleanup(groupId);
      }
    );
  };

  const handleCustomFilter = () => {
    showConfirmation(
      'Custom Filter',
      action === 'remove'
        ? `This will remove all users with status: ${statusFilter}. This action cannot be undone.`
        : `This will list all users with status: ${statusFilter}`,
      'Fetch members: 1-5 requests\n' + (action === 'remove' ? 'Remove users: 1 per user' : 'List only (no modifications)'),
      () => {
        closeModal();
        if (groupId) api.customFilter(groupId, statusFilter, action);
      }
    );
  };

  const handleExport = () => {
    showConfirmation(
      'Export Group Members',
      `This will export group members to ${exportFormat.toUpperCase()} format${
        exportFilter ? ` (filtered by ${exportFilter})` : ''
      }`,
      'Fetch members: 1-5 requests (read-only)\nNo modifications made',
      () => {
        closeModal();
        if (groupId && groupName) {
          api.exportMembers(groupId, groupName, exportFormat, exportFilter);
        }
      }
    );
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

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
          <button className="btn btn-primary" onClick={handleRemoveDeprovisioned} disabled={disabled}>
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
          <select
            id="statusFilter"
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as UserStatus)}
            disabled={disabled}
          >
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
          <select
            id="action"
            className="input"
            value={action}
            onChange={(e) => setAction(e.target.value as 'list' | 'remove')}
            disabled={disabled}
          >
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
          <select
            id="exportFormat"
            className="input"
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
            disabled={disabled}
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
          <label htmlFor="exportFilter">Filter (optional):</label>
          <select
            id="exportFilter"
            className="input"
            value={exportFilter}
            onChange={(e) => setExportFilter(e.target.value as UserStatus | '')}
            disabled={disabled}
          >
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
            <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <p className="progress-text">{progress.message}</p>
        </div>
      </div>

      {/* Confirmation Modal */}
      {modalState && (
        <ConfirmationModal
          isOpen={modalState.isOpen}
          title={modalState.title}
          message={modalState.message}
          apiCost={modalState.apiCost}
          onConfirm={modalState.onConfirm}
          onCancel={closeModal}
        />
      )}
    </div>
  );
};

export default OperationsTab;
