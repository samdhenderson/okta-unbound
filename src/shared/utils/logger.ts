/**
 * Level-gated logger — the single sanctioned logging surface.
 *
 * Rules (see docs/development.md):
 * - Never use raw `console.*` in committed code; use this logger.
 * - Never log secrets or payloads: no XSRF tokens, no request/response bodies,
 *   no user PII. Log identifiers and outcomes, not contents.
 *
 * `debug`/`info` are silenced in production builds; `warn`/`error` always emit.
 * `import.meta.env.DEV` is provided by Vite in every bundled context (side panel,
 * background, content script).
 *
 * @example
 * import { createLogger } from '@/shared/utils/logger';
 * const log = createLogger('Background');
 * log.info('Extension updated', { from: previousVersion, to: version });
 *
 * @module logger
 */

/* eslint-disable no-console -- this module is the one sanctioned console wrapper */

type LogArgs = unknown[];

const isDev = (() => {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
})();

export interface Logger {
  debug: (...args: LogArgs) => void;
  info: (...args: LogArgs) => void;
  warn: (...args: LogArgs) => void;
  error: (...args: LogArgs) => void;
}

/**
 * Create a logger scoped to a subsystem. The scope is prefixed to every line,
 * e.g. `createLogger('ApiScheduler')` → `[ApiScheduler] …`.
 */
export function createLogger(scope: string): Logger {
  const prefix = `[${scope}]`;
  return {
    debug: (...args) => {
      if (isDev) console.debug(prefix, ...args);
    },
    info: (...args) => {
      if (isDev) console.info(prefix, ...args);
    },
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}

/** Default unscoped logger for quick use; prefer a scoped `createLogger`. */
export const logger = createLogger('App');
