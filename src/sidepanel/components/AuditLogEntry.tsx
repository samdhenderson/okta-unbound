import React, { useState } from 'react';
import type { AuditLogEntry } from '../../shared/types';

interface AuditLogEntryProps {
  entry: AuditLogEntry;
  oktaOrigin?: string | null;
}

const AuditLogEntryComponent: React.FC<AuditLogEntryProps> = ({ entry, oktaOrigin }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Format timestamp to relative time
  const getRelativeTime = (timestamp: Date) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  // Get icon based on action type
  const getActionIcon = () => {
    switch (entry.action) {
      case 'remove_users':
        return '👤';
      case 'add_users':
        return '➕';
      case 'export':
        return '📄';
      case 'activate_rule':
        return '✅';
      case 'deactivate_rule':
        return '⏸️';
      default:
        return '📋';
    }
  };

  // Get color based on result
  const getResultColor = () => {
    switch (entry.result) {
      case 'success':
        return '#10b981'; // green
      case 'partial':
        return '#f59e0b'; // yellow
      case 'failed':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  // Format action text
  const getActionText = () => {
    switch (entry.action) {
      case 'remove_users':
        return 'Removed users';
      case 'add_users':
        return 'Added users';
      case 'export':
        return 'Exported members';
      case 'activate_rule':
        return 'Activated rule';
      case 'deactivate_rule':
        return 'Deactivated rule';
      default:
        return entry.action;
    }
  };

  const resultColor = getResultColor();

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        marginBottom: '8px',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
      }}
    >
      {/* Header - always visible */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '12px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderLeft: `4px solid ${resultColor}`,
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f9fafb';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#ffffff';
        }}
      >
        {/* Icon */}
        <div style={{ fontSize: '20px', flexShrink: 0 }}>{getActionIcon()}</div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>
              {getActionText()}
            </span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                backgroundColor: resultColor + '20',
                color: resultColor,
              }}
            >
              {entry.result}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
            {entry.groupName} • {getRelativeTime(entry.timestamp)}
          </div>
        </div>

        {/* Stats summary */}
        <div style={{ fontSize: '12px', color: '#6b7280', flexShrink: 0 }}>
          {entry.action !== 'export' && entry.affectedUsers.length > 0 && (
            <span>{entry.affectedUsers.length} users</span>
          )}
          {entry.action === 'export' && (
            <span>{entry.details.usersSucceeded} exported</span>
          )}
        </div>

        {/* Expand icon */}
        <div
          style={{
            fontSize: '12px',
            color: '#9ca3af',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          ▼
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div
          style={{
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderTop: '1px solid #e5e7eb',
            fontSize: '13px',
          }}
        >
          {/* Metadata grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div>
              <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '4px' }}>
                Performed By
              </div>
              <div style={{ color: '#111827', fontWeight: 500 }}>{entry.performedBy}</div>
            </div>

            <div>
              <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '4px' }}>
                Timestamp
              </div>
              <div style={{ color: '#111827', fontWeight: 500 }}>
                {new Date(entry.timestamp).toLocaleString()}
              </div>
            </div>

            <div>
              <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '4px' }}>Group</div>
              <div style={{ color: '#111827', fontWeight: 500 }}>
                {oktaOrigin ? (
                  <a
                    href={`${oktaOrigin}/admin/group/${entry.groupId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#3b82f6',
                      textDecoration: 'none',
                    }}
                  >
                    {entry.groupName}
                  </a>
                ) : (
                  entry.groupName
                )}
              </div>
            </div>

            <div>
              <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '4px' }}>
                Duration
              </div>
              <div style={{ color: '#111827', fontWeight: 500 }}>
                {entry.details.durationMs < 1000
                  ? `${entry.details.durationMs}ms`
                  : `${(entry.details.durationMs / 1000).toFixed(2)}s`}
              </div>
            </div>
          </div>

          {/* Results summary */}
          {(entry.action === 'remove_users' || entry.action === 'add_users') && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '4px' }}>
                  Total Affected
                </div>
                <div style={{ color: '#111827', fontSize: '20px', fontWeight: 700 }}>
                  {entry.affectedUsers.length}
                </div>
              </div>

              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ color: '#10b981', fontSize: '11px', marginBottom: '4px' }}>
                  Succeeded
                </div>
                <div style={{ color: '#10b981', fontSize: '20px', fontWeight: 700 }}>
                  {entry.details.usersSucceeded}
                </div>
              </div>

              {entry.details.usersFailed > 0 && (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: '#ffffff',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ color: '#ef4444', fontSize: '11px', marginBottom: '4px' }}>
                    Failed
                  </div>
                  <div style={{ color: '#ef4444', fontSize: '20px', fontWeight: 700 }}>
                    {entry.details.usersFailed}
                  </div>
                </div>
              )}

              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '4px' }}>
                  API Requests
                </div>
                <div style={{ color: '#111827', fontSize: '20px', fontWeight: 700 }}>
                  {entry.details.apiRequestCount}
                </div>
              </div>
            </div>
          )}

          {/* Error messages */}
          {entry.details.errorMessages && entry.details.errorMessages.length > 0 && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#fef2f2',
                borderRadius: '6px',
                border: '1px solid #fecaca',
              }}
            >
              <div
                style={{
                  color: '#991b1b',
                  fontSize: '11px',
                  fontWeight: 600,
                  marginBottom: '8px',
                }}
              >
                ERRORS ({entry.details.errorMessages.length})
              </div>
              <div style={{ color: '#dc2626', fontSize: '12px' }}>
                {entry.details.errorMessages.map((msg, idx) => (
                  <div key={idx} style={{ marginBottom: '4px' }}>
                    • {msg}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditLogEntryComponent;
