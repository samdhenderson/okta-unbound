/**
 * @module sidepanel/components/ContextBar
 * @description Unified masthead: app wordmark + entity identity + connection + refresh + pin.
 *
 * Merges the former standalone `Header` (app title + connection) into the context
 * header so the two share one bar. Shows the `Okta Unbound · {pageType}` wordmark
 * eyebrow, a connection dot, the detected entity's name and (copyable) id, and the
 * two global context controls — Refresh and a Pin toggle. Pinning freezes the panel
 * on the current entity so you can cross-reference another Okta page without losing
 * your place; when the live tab moves elsewhere while pinned, a subtle hint offers to
 * switch. The heavy per-entity identity (avatar, status) lives in the content below.
 */
import React, { useState } from 'react';
import { IconButton } from './shared';
import Icon from './overview/shared/Icon';
import type { ConnectionStatus } from '../hooks/useOktaTabContext';

/** Kind of Okta page detected for the active tab. */
type PageType = 'group' | 'user' | 'app' | 'admin' | 'unknown';

/** Props for {@link ContextBar}. */
interface ContextBarProps {
  /** Detected page type; drives the label fallback and dot colour. */
  pageType: PageType;
  /** Display name of the detected (or pinned) entity, if resolved. */
  entityName?: string;
  /** Okta id of the detected (or pinned) entity; gates the id chip + copy. */
  entityId?: string;
  /** Connection state to the Okta tab. */
  connectionStatus: ConnectionStatus;
  /** Whether page context is still resolving. */
  isLoading: boolean;
  /** Connection/context error message, or `null` when healthy. */
  error: string | null;
  /** Whether the panel is currently pinned to `entityName`/`entityId`. */
  isPinned: boolean;
  /** Whether pinning is available right now (a group/user entity is present). */
  canPin: boolean;
  /** While pinned, `true` once the live Okta tab has navigated to another entity. */
  liveContextChanged?: boolean;
  /** Optional name of the live entity, shown in the switch hint when known. */
  liveEntityName?: string;
  /** Toggle the pin on/off. */
  onTogglePin: () => void;
  /** Re-detect the live context (disabled while pinned). */
  onRefresh: () => void;
  /**
   * Reload the Okta tab to re-establish the content script, then re-detect.
   * Shown only when a connection error is present. Omit when there is no tab to
   * reconnect to.
   */
  onReconnect?: () => void;
}

const DOT_COLOR: Record<PageType, string> = {
  group: 'var(--color-primary)',
  user: 'var(--color-accent)',
  app: 'var(--color-success)',
  admin: 'var(--color-neutral-500)',
  unknown: 'var(--color-neutral-500)',
};

const NO_ENTITY_LABEL: Record<PageType, string> = {
  group: 'No group selected',
  user: 'No user selected',
  app: 'No app selected',
  admin: 'Okta Admin',
  unknown: 'No context',
};

/** Wordmark-eyebrow suffix per page type ('' leaves the bare product name). */
const PAGE_LABEL: Record<PageType, string> = {
  group: 'Group',
  user: 'User',
  app: 'App',
  admin: 'Admin',
  unknown: '',
};

/**
 * Renders the slim merged context header. Presentational: pin/refresh behaviour and
 * the live-vs-pinned comparison are owned by the caller (App).
 */
const ContextBar: React.FC<ContextBarProps> = ({
  pageType,
  entityName,
  entityId,
  connectionStatus,
  isLoading,
  error,
  isPinned,
  canPin,
  liveContextChanged = false,
  liveEntityName,
  onTogglePin,
  onRefresh,
  onReconnect,
}) => {
  const [idCopied, setIdCopied] = useState(false);

  const handleCopyId = () => {
    if (!entityId) return;
    navigator.clipboard.writeText(entityId).then(
      () => {
        setIdCopied(true);
        setTimeout(() => setIdCopied(false), 1500);
      },
      () => {
        /* clipboard blocked — fail quietly */
      },
    );
  };

  const displayName = error
    ? 'Not connected'
    : isLoading
      ? 'Loading…'
      : entityName || NO_ENTITY_LABEL[pageType];

  const dotColor = error
    ? 'var(--color-danger)'
    : connectionStatus === 'connecting' || isLoading
      ? 'var(--color-warning)'
      : DOT_COLOR[pageType];

  const connectionText = error
    ? 'Disconnected'
    : connectionStatus === 'connecting' || isLoading
      ? 'Connecting…'
      : 'Connected';

  const wordmarkSuffix = PAGE_LABEL[pageType];
  const liveChanged = isPinned && liveContextChanged;

  return (
    <div
      className="bg-white border-b border-neutral-200 z-40"
      style={{ fontFamily: 'var(--font-primary)' }}
    >
      <div className="px-5 py-3 flex items-center justify-between gap-3">
        {/* Identity */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${connectionStatus === 'connecting' || isLoading ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: dotColor }}
            title={connectionText}
            role="img"
            aria-label={connectionText}
          />
          <div className="min-w-0">
            <div
              className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 leading-none mb-1"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Okta Unbound{wordmarkSuffix ? ` · ${wordmarkSuffix}` : ''}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-neutral-900 truncate">{displayName}</span>
              {isPinned && (
                <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-primary-light text-primary-text">
                  <Icon type="pin" size="sm" className="w-3 h-3" />
                  Pinned
                </span>
              )}
            </div>
            {error && onReconnect && (
              <button
                type="button"
                onClick={onReconnect}
                className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary-text hover:underline"
                title="Reload the Okta tab to re-establish the connection"
              >
                <Icon type="refresh" size="sm" className="w-3 h-3" />
                Reload tab to reconnect
              </button>
            )}
            {entityId && !error && (
              <div className="flex items-center gap-1 mt-0.5">
                <code className="text-[11px] font-mono text-neutral-500 truncate">{entityId}</code>
                <IconButton
                  label={idCopied ? 'Copied!' : 'Copy id'}
                  onClick={handleCopyId}
                  variant="ghost"
                  size="sm"
                >
                  <Icon
                    type={idCopied ? 'clipboard-check' : 'clipboard'}
                    size="sm"
                    className={`w-3.5 h-3.5 ${idCopied ? 'text-success-text' : ''}`}
                  />
                </IconButton>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <IconButton
            label="Refresh context"
            onClick={onRefresh}
            variant="ghost"
            size="sm"
            disabled={isPinned}
            title={isPinned ? 'Unpin to refresh live context' : 'Refresh context'}
          >
            <Icon type="refresh" size="sm" className={isLoading ? 'animate-spin' : ''} />
          </IconButton>
          <button
            type="button"
            onClick={onTogglePin}
            disabled={!canPin && !isPinned}
            title={
              isPinned
                ? 'Unpin — resume following the live Okta tab'
                : canPin
                  ? 'Pin this context while you cross-reference another page'
                  : 'Navigate to a group or user page to pin it'
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed ${
              isPinned
                ? 'bg-primary text-white hover:bg-primary-dark'
                : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-500'
            }`}
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <Icon type="pin" size="sm" />
            <span>{isPinned ? 'Pinned' : 'Pin'}</span>
          </button>
        </div>
      </div>

      {/* Live-context-changed hint (pinned only) */}
      {liveChanged && (
        <div className="px-5 py-2 bg-warning-light border-t border-warning-light flex items-center justify-between gap-2 text-xs text-warning-text">
          <span className="truncate">
            {liveEntityName ? (
              <>
                Live tab moved to <strong>{liveEntityName}</strong>
              </>
            ) : (
              'The live Okta tab has changed'
            )}
          </span>
          <button
            type="button"
            onClick={onTogglePin}
            className="shrink-0 font-semibold underline hover:no-underline"
          >
            Unpin &amp; switch
          </button>
        </div>
      )}
    </div>
  );
};

export default ContextBar;
