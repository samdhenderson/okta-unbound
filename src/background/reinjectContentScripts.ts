/**
 * @module background/reinjectContentScripts
 * @description Re-inject the manifest-declared content scripts into already-open
 * Okta tabs after an install or update.
 *
 * **Why this exists:** manifest-declared content scripts are injected by Chrome only
 * when a matching page *loads*. When the extension is installed, updated or reloaded,
 * MV3 tears the old content script's runtime out from under it — every already-open
 * Okta tab is left with an orphaned script whose `chrome.runtime` is invalidated — and
 * does **not** inject the new one. The side panel reports "Disconnected" until the user
 * manually reloads each tab. Re-injecting from `onInstalled` closes that gap.
 *
 * **Scope:** the files and match patterns are read back from
 * `chrome.runtime.getManifest()`, so the built (crxjs-rewritten) script paths are used
 * and injection can never reach beyond the tabs the manifest already matches. See
 * ADR-0015 for the `scripting` permission justification.
 *
 * @see `src/background/index.ts` for the `onInstalled` wiring
 * @see `src/content/index.ts` for the matching double-injection guard
 */

import { createLogger } from '../shared/utils/logger';

const log = createLogger('Background');

/**
 * Re-inject every manifest-declared content script into the currently open tabs it
 * matches.
 *
 * For each `content_scripts` entry the manifest declares, the tabs matching that
 * entry's `matches` patterns are queried and the entry's built `js` files are
 * executed in them. Injection is bounded by the manifest's own match patterns —
 * nothing is hardcoded, so a build-time filename rewrite or a match-pattern change
 * is picked up automatically.
 *
 * Failures are non-fatal by design: a single tab can refuse injection (discarded,
 * mid-navigation, or an edge-case restricted URL) without affecting the other tabs,
 * and a run with no matching tabs — or a manifest with no content scripts — is a
 * clean no-op. Only tab ids and outcomes are logged, never URLs or page content.
 *
 * @returns A promise that resolves once every matched tab has been attempted.
 */
export async function reinjectContentScripts(): Promise<void> {
  const entries = chrome.runtime.getManifest().content_scripts ?? [];

  if (entries.length === 0) {
    log.debug('No content scripts declared; nothing to re-inject');
    return;
  }

  for (const entry of entries) {
    const files = entry.js ?? [];
    const matches = entry.matches ?? [];

    if (files.length === 0 || matches.length === 0) {
      log.debug('Skipping content script entry with no files or matches');
      continue;
    }

    let tabs: chrome.tabs.Tab[];
    try {
      tabs = await chrome.tabs.query({ url: matches });
    } catch (error) {
      log.warn('Tab query for content script re-injection failed', error);
      continue;
    }

    for (const tab of tabs) {
      const tabId = tab.id;
      if (typeof tabId !== 'number') continue;

      try {
        await chrome.scripting.executeScript({ target: { tabId }, files });
        log.debug('Re-injected content script', { tabId });
      } catch {
        // Expected for discarded tabs, tabs mid-navigation, and pages Chrome
        // refuses to script. Log the tab id and outcome only — never the URL.
        log.debug('Content script re-injection skipped for tab', { tabId });
      }
    }
  }
}
