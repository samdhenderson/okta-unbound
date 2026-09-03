/**
 * @module sidepanel/contexts/OrgEntityIndexContext
 * @description The panel's single mount of the org snapshot index — one owner
 * for the four `useOrgSnapshot` reads and four `snapshotUpdated` listeners that
 * {@link module:sidepanel/hooks/useOrgEntityIndex} opens.
 *
 * The index's own module header has always said that one mount is the thing it
 * exists to guarantee: two hooks reading the same collection open two IndexedDB
 * reads and register two broadcast listeners for one answer. That was a
 * convention, and the convention broke — Home mounted one and the ⌘K palette
 * mounted a second, so one org's four collections cost eight reads and eight
 * listeners (`I-033`). This provider makes it structural: `useOrgEntityIndexSource`
 * is called here and nowhere else, and every surface reads the published value.
 *
 * ## `enabled` is the union of its readers, not `true`
 *
 * Tabs stay mounted (ADR-0018), so a provider at the shell is mounted for the
 * whole session and "mounted" says nothing about whether anyone is looking. The
 * store is still read and broadcasts still tracked when `enabled` is `false`;
 * what it gates is the *sync* — org-wide Okta traffic. `App` therefore passes
 * the union of the two surfaces that read the index: Home being the tab on
 * screen, or the palette being open. That is exactly the set of moments in which
 * one of the two former mounts was `enabled`, so lifting them changes when
 * traffic is issued not at all.
 *
 * ## Nothing was lost by dropping the palette's latch
 *
 * `CommandPalette` used to pass `oktaOrigin: null` until its first ⌘K, so a
 * session that never summoned it paid for no reads. That latch guarded the
 * *second* set of reads, not a distinct set: the palette read the same four
 * collections Home reads, and Home is mounted from panel open with the origin
 * always set. One set of reads, opened at panel open, is therefore what happened
 * before this provider existed and what happens now — the saving the latch
 * bought is the whole of what the provider makes permanent, so there is no
 * remaining laziness for it to protect and no cost it can still avoid.
 */
import React, { createContext, useContext, type ReactNode } from 'react';
import {
  useOrgEntityIndexSource,
  type OrgEntityIndex,
  type UseOrgEntityIndexSourceOptions,
} from '../hooks/useOrgEntityIndex';

/**
 * `undefined` means "no provider" rather than "an empty index", deliberately: an
 * inert default would answer every lookup `'unknown'`, which reads as a snapshot
 * that cannot say and would quietly turn every zero-request answer into a
 * request. A surface that forgot the provider should say so loudly instead.
 */
const OrgEntityIndexContext = createContext<OrgEntityIndex | undefined>(undefined);

/** Props for {@link OrgEntityIndexProvider}. */
export interface OrgEntityIndexProviderProps extends UseOrgEntityIndexSourceOptions {
  /** The subtree that may call {@link useOrgEntityIndex}. */
  children: ReactNode;
}

/**
 * Mount the org snapshot index once and publish it.
 *
 * Belongs at the shell, above both the tab panels and the ⌘K palette — they are
 * siblings, so no lower node can serve both.
 *
 * @param props - See {@link OrgEntityIndexProviderProps}.
 *
 * @example
 * ```tsx
 * <OrgEntityIndexProvider
 *   oktaOrigin={tabContext.oktaOrigin ?? null}
 *   targetTabId={tabContext.targetTabId ?? null}
 *   enabled={activeTab === 'home' || jumpPalette.isOpen}
 * >
 *   {shell}
 * </OrgEntityIndexProvider>
 * ```
 */
export const OrgEntityIndexProvider: React.FC<OrgEntityIndexProviderProps> = ({
  oktaOrigin,
  targetTabId,
  enabled = true,
  children,
}) => {
  const index = useOrgEntityIndexSource({ oktaOrigin, targetTabId, enabled });
  return <OrgEntityIndexContext.Provider value={index}>{children}</OrgEntityIndexContext.Provider>;
};

/**
 * Read the panel's one org snapshot index.
 *
 * Costs nothing: the reads and listeners belong to the provider, so any number
 * of surfaces may call this.
 *
 * @returns The published {@link OrgEntityIndex}.
 * @throws If called outside an {@link OrgEntityIndexProvider}.
 */
export const useOrgEntityIndex = (): OrgEntityIndex => {
  const index = useContext(OrgEntityIndexContext);
  if (!index) {
    throw new Error('useOrgEntityIndex must be used within an OrgEntityIndexProvider');
  }
  return index;
};
