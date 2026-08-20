/**
 * @module sidepanel/hooks/useProfileDisplayConfig
 * @description React binding over {@link module:shared/storage/profileDisplayStore}
 * for the "Configure profile display" modal and the profile view it drives.
 *
 * Two configs live here and the distinction is the whole point of the module:
 *
 * - the **stored** config, written verbatim to IndexedDB, which retains placements
 *   for attributes that are not currently in the schema (a failed schema fetch or
 *   a user missing a field must not erase where the admin filed that attribute);
 * - the **reconciled** config, which is what {@link UseProfileDisplayConfig.config}
 *   returns — the stored config projected onto the attributes that actually exist
 *   right now, with unknown names dropped, brand-new names appended as
 *   uncategorized, and assignments to deleted categories falling back to
 *   uncategorized.
 *
 * Writes are coalesced behind a short timer so dragging a reorder handle or typing
 * a category name does not thrash IndexedDB; a pending write is flushed on unmount.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  profileDisplayStore,
  DEFAULT_PROFILE_DISPLAY_CONFIG,
  type ProfileDisplayConfig,
} from '@/shared/storage/profileDisplayStore';

/** How long edits are coalesced before one write reaches IndexedDB. */
const PERSIST_DEBOUNCE_MS = 400;

/** What {@link useProfileDisplayConfig} returns. */
export interface UseProfileDisplayConfig {
  /**
   * The reconciled config — never `null`, and never containing an attribute that
   * is not in `knownAttributeNames`. Defaults until a saved config loads.
   */
  config: ProfileDisplayConfig;
  /**
   * `false` only while the org's saved config is being read. `true` immediately
   * when there is no origin, since there is then nothing to wait for.
   */
  isLoaded: boolean;
  /** Apply a partial change and persist it (coalesced). */
  update: (patch: Partial<ProfileDisplayConfig>) => void;
  /** Discard the org's config and return to {@link DEFAULT_PROFILE_DISPLAY_CONFIG}. */
  reset: () => void;
}

/**
 * Merge a patch record over the stored one, keeping only the stored entries whose
 * attribute is currently *unknown*.
 *
 * Known attributes are taken from the patch alone, so an entry the caller dropped
 * is really dropped; unknown attributes are retained untouched, because the patch
 * was computed from the reconciled config and could not have mentioned them.
 */
function mergeRecord<T>(
  stored: Record<string, T>,
  patch: Record<string, T>,
  known: ReadonlySet<string>,
): Record<string, T> {
  const retained: Record<string, T> = {};
  for (const [name, value] of Object.entries(stored)) {
    if (!known.has(name)) retained[name] = value;
  }
  return { ...retained, ...patch };
}

/**
 * Merge a reordered list of known attributes back into the stored order.
 *
 * The stored order's known entries are treated as slots: they are refilled, in
 * sequence, from the incoming order, while unknown entries stay pinned where they
 * are so a temporarily-absent attribute returns to roughly its old neighbourhood.
 * Anything left over (newly-known attributes) is appended.
 */
function mergeOrder(
  stored: readonly string[],
  patch: readonly string[],
  known: ReadonlySet<string>,
): string[] {
  const incoming = patch.filter((name) => known.has(name));
  const merged: string[] = [];
  let next = 0;
  for (const name of stored) {
    if (known.has(name)) {
      if (next < incoming.length) merged.push(incoming[next++]);
    } else {
      merged.push(name);
    }
  }
  while (next < incoming.length) merged.push(incoming[next++]);
  return [...new Set(merged)];
}

/**
 * Fold a patch into the stored config, preserving placements for attributes that
 * are not currently known.
 */
function mergeStoredConfig(
  stored: ProfileDisplayConfig,
  patch: Partial<ProfileDisplayConfig>,
  known: ReadonlySet<string>,
): ProfileDisplayConfig {
  return {
    ...stored,
    ...patch,
    attrOrder: patch.attrOrder
      ? mergeOrder(stored.attrOrder, patch.attrOrder, known)
      : stored.attrOrder,
    assign: patch.assign ? mergeRecord(stored.assign, patch.assign, known) : stored.assign,
    hidden: patch.hidden ? mergeRecord(stored.hidden, patch.hidden, known) : stored.hidden,
  };
}

/**
 * Project the stored config onto the attributes that exist right now.
 *
 * Every known attribute appears exactly once in `attrOrder` and has an `assign`
 * entry — `''` for uncategorized, which is also where an attribute filed under a
 * since-deleted category lands. Attributes the stored config knows about but the
 * schema does not are omitted (they survive in storage, not on screen).
 */
function reconcileConfig(
  stored: ProfileDisplayConfig,
  knownAttributeNames: readonly string[],
): ProfileDisplayConfig {
  const known = new Set(knownAttributeNames);
  const categoryKeys = new Set(stored.categories.map((category) => category.key));

  const attrOrder = [...new Set(stored.attrOrder.filter((name) => known.has(name)))];
  const placed = new Set(attrOrder);
  for (const name of knownAttributeNames) {
    if (!placed.has(name)) {
      attrOrder.push(name);
      placed.add(name);
    }
  }

  const assign: Record<string, string> = {};
  const hidden: Record<string, boolean> = {};
  for (const name of attrOrder) {
    const category = stored.assign[name];
    assign[name] = category && categoryKeys.has(category) ? category : '';
    if (stored.hidden[name]) hidden[name] = true;
  }

  return { ...stored, attrOrder, assign, hidden };
}

/**
 * Load, reconcile, and persist one admin's profile display configuration for an
 * Okta org.
 *
 * @param oktaOrigin - The org origin the config belongs to. With no origin the
 *   hook returns defaults and never touches storage.
 * @param knownAttributeNames - The profile attributes that currently exist, in the
 *   order they should be appended when they have no saved placement. Memoized
 *   internally on the joined names, so a fresh array each render is fine.
 * @returns The reconciled config plus load state and mutators
 *   (see {@link UseProfileDisplayConfig}).
 */
export function useProfileDisplayConfig(
  oktaOrigin: string | null | undefined,
  knownAttributeNames: readonly string[],
): UseProfileDisplayConfig {
  const [stored, setStored] = useState<ProfileDisplayConfig>(DEFAULT_PROFILE_DISPLAY_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);

  // `knownAttributeNames` is a fresh array on most renders; key the memos off its
  // contents instead of its identity.
  const knownKey = knownAttributeNames.join(',');
  const known = useMemo(
    () => new Set(knownAttributeNames),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- knownKey captures the contents
    [knownKey],
  );

  // Mirrors `stored` for the mutators, which must fold a patch into the latest
  // stored config synchronously to hand the same value to the persist timer.
  const storedRef = useRef<ProfileDisplayConfig>(DEFAULT_PROFILE_DISPLAY_CONFIG);
  const applyStored = useCallback((next: ProfileDisplayConfig) => {
    storedRef.current = next;
    setStored(next);
  }, []);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ oktaOrigin: string; config: ProfileDisplayConfig } | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) void profileDisplayStore.saveConfig(pending.oktaOrigin, pending.config);
  }, []);

  const schedulePersist = useCallback(
    (config: ProfileDisplayConfig) => {
      if (!oktaOrigin) return;
      pendingRef.current = { oktaOrigin, config };
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, PERSIST_DEBOUNCE_MS);
    },
    [oktaOrigin, flush],
  );

  useEffect(() => {
    if (!oktaOrigin) {
      applyStored(DEFAULT_PROFILE_DISPLAY_CONFIG);
      setIsLoaded(true);
      return;
    }

    let cancelled = false;
    setIsLoaded(false);
    void profileDisplayStore
      .getConfig(oktaOrigin)
      .catch(() => null)
      .then((saved) => {
        if (cancelled) return;
        applyStored(saved ?? DEFAULT_PROFILE_DISPLAY_CONFIG);
        setIsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [oktaOrigin, applyStored]);

  // Flush a coalesced write on unmount so closing the modal never loses an edit.
  useEffect(() => flush, [flush]);

  const update = useCallback(
    (patch: Partial<ProfileDisplayConfig>) => {
      const next = mergeStoredConfig(storedRef.current, patch, known);
      applyStored(next);
      schedulePersist(next);
    },
    [known, applyStored, schedulePersist],
  );

  const reset = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    applyStored(DEFAULT_PROFILE_DISPLAY_CONFIG);
    if (oktaOrigin) void profileDisplayStore.clearConfig(oktaOrigin);
  }, [oktaOrigin, applyStored]);

  const config = useMemo(
    () => reconcileConfig(stored, knownAttributeNames),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- knownKey captures the contents
    [stored, knownKey],
  );

  return { config, isLoaded, update, reset };
}
