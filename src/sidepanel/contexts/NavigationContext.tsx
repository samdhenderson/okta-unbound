/**
 * @module sidepanel/contexts/NavigationContext
 * @description Cross-entity navigation: "take me to that rule / group / user / app".
 *
 * The jump handlers already existed — `App` has held `handleNavigateToRule`,
 * `handleNavigateToGroup` and `handleNavigateToUser` for a while, and the
 * receiving tabs already consume `selectedRuleId` / `selectedGroupId` /
 * `selectedUserId`. What was missing is a way to *reach* them: they were
 * prop-drilled ad hoc, so the Apps and Policies tabs received none at all, the
 * Users tab never received `onNavigateToGroup`, and `RuleCard`'s "then add to
 * groups" chips stayed inert text because threading a callback that far down was
 * more work than the chip was worth. A context makes the cost of linking zero at
 * any depth.
 *
 * ## Absence is a first-class answer
 *
 * {@link useEntityNavigation} never throws when no provider is mounted, and a
 * provider may deliberately omit a handler for an entity type it cannot reach
 * yet. Both cases surface through {@link EntityNavigation.canNavigateTo}, which
 * is what lets `EntityLink` degrade to plain text instead of rendering a control
 * that does nothing. That matters beyond convenience: some names in this app
 * genuinely have no navigable target — a rule condition's
 * `isMemberOfGroupName("sales")` carries a name and no id, and one name can match
 * an Okta group *and* a Workday group — so "not linkable" has to be an expressible
 * state rather than a bug.
 *
 * Ids here are opaque Okta identifiers (`0pr…`, `00g…`, `00u…`, `0oa…`). Nothing
 * in this module logs them.
 */
import React, { createContext, useContext, useMemo, type ReactNode } from 'react';

/** The entity kinds one surface can send a reader to another surface to see. */
export type EntityType = 'rule' | 'group' | 'user' | 'app' | 'policy';

/** A navigable reference: an entity kind plus its Okta id. */
export interface EntityRef {
  /** Which kind of entity, deciding both the destination tab and the glyph. */
  type: EntityType;
  /** The Okta id to open. */
  id: string;
}

/**
 * Per-type jump handlers. A type whose handler is omitted is reported as
 * unreachable rather than silently doing nothing — see the module note.
 */
export type NavigationHandlers = Partial<Record<EntityType, (id: string) => void>>;

/** The context value returned by {@link useEntityNavigation}. */
export interface EntityNavigation {
  /** Open the referenced entity on its own tab. A no-op for an unreachable type. */
  navigateTo: (ref: EntityRef) => void;
  /** Whether this build can currently navigate to that entity kind. */
  canNavigateTo: (type: EntityType) => boolean;
}

/**
 * The value used when no provider is mounted: nothing is reachable, and
 * `navigateTo` is inert. Frozen at module scope so consumers memoized on the
 * context value do not re-render when a provider-less tree re-renders.
 */
const NO_NAVIGATION: EntityNavigation = {
  navigateTo: () => {},
  canNavigateTo: () => false,
};

const NavigationContext = createContext<EntityNavigation>(NO_NAVIGATION);

/** Props for {@link NavigationProvider}. */
export interface NavigationProviderProps {
  /**
   * The jump handlers this build can honour. Omit a type that has no destination
   * yet; `EntityLink` will render its name as plain text rather than as a dead
   * control.
   */
  handlers: NavigationHandlers;
  children: ReactNode;
}

/**
 * Publishes the app's cross-entity jump handlers to the whole tree.
 *
 * @example
 * ```tsx
 * <NavigationProvider handlers={{ rule: handleNavigateToRule, group: handleNavigateToGroup }}>
 *   <App />
 * </NavigationProvider>
 * ```
 */
export const NavigationProvider: React.FC<NavigationProviderProps> = ({ handlers, children }) => {
  const value = useMemo<EntityNavigation>(
    () => ({
      navigateTo: ({ type, id }) => handlers[type]?.(id),
      canNavigateTo: (type) => typeof handlers[type] === 'function',
    }),
    [handlers],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

/**
 * Access cross-entity navigation.
 *
 * Never throws: outside a {@link NavigationProvider} it reports every entity kind
 * as unreachable, so a component rendered in a story or a unit test needs no
 * wrapper and still renders its non-navigating fallback.
 *
 * @returns The navigation surface; inert when no provider is mounted.
 */
export const useEntityNavigation = (): EntityNavigation => useContext(NavigationContext);
