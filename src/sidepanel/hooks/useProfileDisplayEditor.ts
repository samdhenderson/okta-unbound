/**
 * @module sidepanel/hooks/useProfileDisplayEditor
 * @description The state behind customize mode in the Profile pane: one local
 * draft {@link ProfileDisplayConfig}, the verbs that transform it, and the
 * pointer/keyboard reorder machine that drives them.
 *
 * Three decisions shape this hook.
 *
 * **The draft is local until Done.** The configuration modal this replaces wrote
 * live — every click landed in IndexedDB. Here the admin edits a copy:
 * {@link ProfileDisplayEditorApi.commit} hands the whole config back,
 * {@link ProfileDisplayEditorApi.cancel} throws it away, and `Reset to default`
 * acts on the draft too, so it stays undoable until Done.
 *
 * **Every transform lives in `profileDisplayOps`.** This hook holds no placement
 * rules of its own — it decides *when* a move happens and says what happened;
 * what a move means is a pure function next to the pane. That is also what makes
 * a pointer drop and an arrow-key press provably the same edit.
 *
 * **Reordering is dual-input by construction.** A drag ends in
 * {@link ProfileDisplayEditorApi.place}; a keyboard lift steps through
 * `stepAttribute`/`moveCategory`; both publish the same
 * {@link ProfileDisplayEditorApi.announcement} for an `aria-live` region. A
 * pointer-only reorder would be unusable with a screen reader, and a silent
 * keyboard reorder would be unverifiable with one.
 *
 * Security: category names, attribute names and attribute values are untrusted
 * tenant data and frequently PII. Nothing here logs, and nothing leaves the hook
 * but the config the caller passed in, transformed.
 */
// `React` as a type-only import, and the DOM event types spelled `globalThis.*`:
// neither is in the ESLint DOM globals allow-list in `eslint.config.js`.
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_PROFILE_DISPLAY_CONFIG,
  type ProfileDisplayCategory,
  type ProfileDisplayConfig,
} from '../../shared/storage/profileDisplayStore';
import type { AttributeDescriptor } from '../components/users/profileAttributes';
import { UNCATEGORIZED, UNCATEGORIZED_LABEL } from '../components/users/profileAttributeBlocks';
import {
  addCategory,
  completeAssign,
  completeHidden,
  deleteCategory,
  indexOfAttribute,
  moveCategory,
  placeAttribute,
  renameCategory,
  sectionOrder,
  stepAttribute,
  toggleHidden,
  type AttributeStep,
} from '../components/users/profileDisplayOps';
import { useReducedMotion } from './useReducedMotion';

/** What is being reordered: one attribute row, or a whole section. */
export type EditorDragKind = 'attr' | 'section';

/** How far a pointer must travel before a press stops being a click. */
const ACTIVATION_PX = 4;

/** The lift currently in progress. */
export interface EditorDrag {
  /** Whether an attribute row or a section is lifted. */
  kind: EditorDragKind;
  /** The attribute's Okta name, or the category's stable key. */
  id: string;
  /** The lifted thing's human label — what the ghost and the announcement say. */
  label: string;
  /** `true` when the lift came from the keyboard, so arrow keys drive it. */
  keyboard: boolean;
}

/** Where the lifted thing would land if it were dropped right now. */
export interface EditorDropTarget {
  /** Whether the target describes an attribute position or a section position. */
  kind: EditorDragKind;
  /**
   * For an attribute, the destination category key ({@link UNCATEGORIZED} for the
   * trailing block). For a section, the key of the section being moved.
   */
  key: string;
  /** Zero-based destination position within that list. */
  index: number;
}

/** Viewport coordinates the drag ghost follows. */
export interface EditorGhost {
  /** Client X of the pointer. */
  x: number;
  /** Client Y of the pointer. */
  y: number;
}

/** The four display toggles the editor can change on the draft. */
export type ProfileDisplayOptionKey = 'layout' | 'showApiNames' | 'showRuleChips' | 'showEmpty';

/** What {@link useProfileDisplayEditor} hands its components. */
export interface ProfileDisplayEditorApi {
  /** The configuration being edited. Nothing is persisted until `commit`. */
  draft: ProfileDisplayConfig;
  /** The draft's categories with Uncategorized pinned last — what the editor maps over. */
  sections: ReadonlyArray<ProfileDisplayCategory>;
  /** Set one display toggle on the draft. */
  setOption: <K extends ProfileDisplayOptionKey>(key: K, value: ProfileDisplayConfig[K]) => void;
  /** Give a category a new label; its key, and so its membership, is untouched. */
  rename: (key: string, name: string) => void;
  /** Append a category. A blank name adds nothing. */
  add: (name: string) => void;
  /** Delete a category, returning its attributes to Uncategorized. */
  remove: (key: string) => void;
  /** Flip one attribute's visibility. Its row stays in the editor either way. */
  toggleHidden: (name: string) => void;
  /** Move one attribute into a section at a position, and say where it landed. */
  place: (name: string, key: string, index: number) => void;
  /** Move one category to a position among the categories, and say where it landed. */
  moveSection: (key: string, index: number) => void;
  /** Hand the whole draft to the caller. */
  commit: () => void;
  /** Discard the draft. */
  cancel: () => void;
  /** Replace the draft with the shipped default, reconciled onto this profile. */
  resetToDefault: () => void;
  /** The lift in progress, or `null`. */
  drag: EditorDrag | null;
  /** Where a drop would land right now, or `null`. */
  dropTarget: EditorDropTarget | null;
  /** Pointer position for the ghost, or `null` while no pointer drag is active. */
  ghost: EditorGhost | null;
  /** `true` when the ghost must not animate its follow. */
  reducedMotion: boolean;
  /** Start a pointer drag; nothing lifts until the pointer travels 4px. */
  beginDrag: (
    kind: EditorDragKind,
    id: string,
    event: React.PointerEvent<globalThis.Element>,
  ) => void;
  /** Lift with the keyboard, from a grip handle that keeps focus. */
  lift: (kind: EditorDragKind, id: string) => void;
  /** Move the lifted thing one step. Ignored when nothing is lifted. */
  step: (direction: AttributeStep) => void;
  /** Commit the lift where it stands. */
  drop: () => void;
  /** Abandon the lift and restore the draft to its pre-lift state. */
  cancelDrag: () => void;
  /** The sentence for the editor's `aria-live` region. Empty before the first move. */
  announcement: string;
}

/** Arguments to {@link useProfileDisplayEditor}. */
export interface UseProfileDisplayEditorOptions {
  /** Every attribute on this profile — the set `assign` and `hidden` must cover. */
  attributes: readonly AttributeDescriptor[];
  /** The reconciled configuration the draft starts from. */
  config: ProfileDisplayConfig;
  /** Called with the whole draft when the admin presses Done. */
  onCommit: (config: ProfileDisplayConfig) => void;
  /** Called when the admin presses Cancel. */
  onCancel: () => void;
}

/** A pointer press that has not yet travelled far enough to be a drag. */
interface PendingPress {
  kind: EditorDragKind;
  id: string;
  x: number;
  y: number;
}

/** The label an attribute or a category shows while it is lifted. */
function labelFor(
  kind: EditorDragKind,
  id: string,
  attributes: readonly AttributeDescriptor[],
  config: ProfileDisplayConfig,
): string {
  if (kind === 'section') {
    return config.categories.find((category) => category.key === id)?.name ?? UNCATEGORIZED_LABEL;
  }
  return attributes.find((attribute) => attribute.name === id)?.label ?? id;
}

/** A section's label, for a sentence that has to name where something landed. */
function sectionName(config: ProfileDisplayConfig, key: string): string {
  return sectionOrder(config).find((section) => section.key === key)?.name ?? UNCATEGORIZED_LABEL;
}

/**
 * Where an attribute would land, from the pointer's Y against the rendered
 * `[data-section]` / `[data-row]` boxes.
 *
 * The dragged row is excluded from the count because `placeAttribute` indexes
 * into the section *after* lifting the attribute out of its old place.
 */
function attributeTargetAt(draggedName: string, y: number): EditorDropTarget | null {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-section]'));
  if (sections.length === 0) return null;

  const host =
    sections.find((section) => {
      const rect = section.getBoundingClientRect();
      return y >= rect.top && y <= rect.bottom;
    }) ??
    (y < sections[0].getBoundingClientRect().top ? sections[0] : sections[sections.length - 1]);

  const rows = Array.from(host.querySelectorAll<HTMLElement>('[data-row]')).filter(
    (row) => row.dataset.row !== draggedName,
  );

  let index = rows.length;
  for (let position = 0; position < rows.length; position += 1) {
    const rect = rows[position].getBoundingClientRect();
    if (y < rect.top + rect.height / 2) {
      index = position;
      break;
    }
  }
  return { kind: 'attr', key: host.dataset.section ?? UNCATEGORIZED, index };
}

/**
 * Where a section would land, from the pointer's Y against the other sections'
 * boxes. Uncategorized is excluded: it is pinned last and is not a category.
 */
function sectionTargetAt(draggedKey: string, y: number): EditorDropTarget {
  const others = Array.from(document.querySelectorAll<HTMLElement>('[data-section]')).filter(
    (section) => {
      const key = section.dataset.section ?? UNCATEGORIZED;
      return key !== UNCATEGORIZED && key !== draggedKey;
    },
  );

  let index = others.length;
  for (let position = 0; position < others.length; position += 1) {
    const rect = others[position].getBoundingClientRect();
    if (y < rect.top + rect.height / 2) {
      index = position;
      break;
    }
  }
  return { kind: 'section', key: draggedKey, index };
}

/**
 * Own customize mode's draft configuration and its reorder machine.
 *
 * @param options - The profile being edited and the two exits from the editor.
 * @returns The draft, the verbs that change it, and the drag/lift state the
 *   editor's components render.
 *
 * @example
 * ```tsx
 * const editor = useProfileDisplayEditor({ attributes, config, onCommit, onCancel });
 * <IconButton onPointerDown={(event) => editor.beginDrag('attr', name, event)} … />
 * ```
 */
export function useProfileDisplayEditor({
  attributes,
  config,
  onCommit,
  onCancel,
}: UseProfileDisplayEditorOptions): ProfileDisplayEditorApi {
  // Seeded once: the editor mounts when customize mode opens and unmounts when it
  // closes, so a later change to `config` would be the caller echoing back the
  // draft it was just handed — re-seeding on it would clobber the edit.
  const [draft, setDraft] = useState<ProfileDisplayConfig>(config);
  const [drag, setDrag] = useState<EditorDrag | null>(null);
  const [dropTarget, setDropTarget] = useState<EditorDropTarget | null>(null);
  const [ghost, setGhost] = useState<EditorGhost | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [isPointerSession, setIsPointerSession] = useState(false);

  // Mirrors, so the window listeners can be attached once per pointer session
  // instead of being torn down and rebuilt on every pointermove. Written in an
  // effect rather than during render: a ref is not render state, and the only
  // readers are event handlers, which run after the effect has flushed.
  const draftRef = useRef(draft);
  const dragRef = useRef(drag);
  const dropTargetRef = useRef(dropTarget);
  const attributesRef = useRef(attributes);
  useEffect(() => {
    draftRef.current = draft;
    dragRef.current = drag;
    dropTargetRef.current = dropTarget;
    attributesRef.current = attributes;
  });

  const pending = useRef<PendingPress | null>(null);
  const preLift = useRef<ProfileDisplayConfig | null>(null);
  const reducedMotion = useReducedMotion();

  const sections = useMemo(() => sectionOrder(draft), [draft]);

  const setOption = useCallback(
    <K extends ProfileDisplayOptionKey>(key: K, value: ProfileDisplayConfig[K]): void => {
      setDraft((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const rename = useCallback((key: string, name: string): void => {
    setDraft((current) => renameCategory(current, key, name));
  }, []);

  const add = useCallback((name: string): void => {
    setDraft((current) => addCategory(current, name));
  }, []);

  const remove = useCallback((key: string): void => {
    setDraft((current) => deleteCategory(current, attributesRef.current, key));
  }, []);

  const hide = useCallback((name: string): void => {
    setDraft((current) => toggleHidden(current, attributesRef.current, name));
  }, []);

  const place = useCallback((name: string, key: string, index: number): void => {
    const current = draftRef.current;
    const next = placeAttribute(current, attributesRef.current, name, key, index);
    setDraft(next);
    setAnnouncement(
      `${labelFor('attr', name, attributesRef.current, next)} moved to ${sectionName(next, key)}, ` +
        `position ${indexOfAttribute(next, name) + 1}.`,
    );
  }, []);

  const moveSection = useCallback((key: string, index: number): void => {
    const next = moveCategory(draftRef.current, key, index);
    setDraft(next);
    const landed = next.categories.findIndex((category) => category.key === key);
    setAnnouncement(
      `${labelFor('section', key, [], next)} moved to position ${landed + 1} of ${next.categories.length}.`,
    );
  }, []);

  const commit = useCallback((): void => {
    onCommit(draftRef.current);
  }, [onCommit]);

  const resetToDefault = useCallback((): void => {
    const base = DEFAULT_PROFILE_DISPLAY_CONFIG;
    const all = attributesRef.current;
    setDraft({
      ...base,
      categories: base.categories.map((category) => ({ ...category })),
      assign: completeAssign(all, base),
      hidden: completeHidden(all, base),
      // Every default assignment is Uncategorized, so inventory order already is
      // the section-order partition `attrOrder` promises.
      attrOrder: all.map((attribute) => attribute.name),
    });
    setAnnouncement('Display reset to the default. Nothing is saved until you press Done.');
  }, []);

  /** Clear every trace of a lift, pointer or keyboard. */
  const endSession = useCallback((): void => {
    pending.current = null;
    preLift.current = null;
    setIsPointerSession(false);
    setDrag(null);
    setDropTarget(null);
    setGhost(null);
  }, []);

  const drop = useCallback((): void => {
    const lifted = dragRef.current;
    const target = dropTargetRef.current;
    if (lifted && target) {
      if (target.kind === 'section') moveSection(lifted.id, target.index);
      else place(lifted.id, target.key, target.index);
    } else if (lifted) {
      setAnnouncement(`${lifted.label} kept its position.`);
    }
    endSession();
  }, [endSession, moveSection, place]);

  const cancelDrag = useCallback((): void => {
    const lifted = dragRef.current;
    if (lifted) {
      if (preLift.current) setDraft(preLift.current);
      setAnnouncement(`Move cancelled. ${lifted.label} is back where it started.`);
    }
    endSession();
  }, [endSession]);

  const beginDrag = useCallback(
    (kind: EditorDragKind, id: string, event: React.PointerEvent<globalThis.Element>): void => {
      pending.current = { kind, id, x: event.clientX, y: event.clientY };
      preLift.current = draftRef.current;
      setIsPointerSession(true);
    },
    [],
  );

  const lift = useCallback((kind: EditorDragKind, id: string): void => {
    const current = draftRef.current;
    const label = labelFor(kind, id, attributesRef.current, current);
    preLift.current = current;
    setDrag({ kind, id, label, keyboard: true });
    setDropTarget(null);
    setGhost(null);
    setAnnouncement(
      `${label} lifted. Use the arrow keys to move it, Enter to drop, Escape to cancel.`,
    );
  }, []);

  const step = useCallback(
    (direction: AttributeStep): void => {
      const lifted = dragRef.current;
      if (!lifted) return;
      const current = draftRef.current;
      const backwards = direction === 'up' || direction === 'prev-section';

      if (lifted.kind === 'section') {
        const at = current.categories.findIndex((category) => category.key === lifted.id);
        if (at === -1) return;
        const to = backwards ? at - 1 : at + 1;
        if (to < 0 || to >= current.categories.length) {
          setAnnouncement(
            `${lifted.label} is already the ${backwards ? 'first' : 'last'} section. ` +
              `It cannot move ${backwards ? 'up' : 'down'}.`,
          );
          return;
        }
        moveSection(lifted.id, to);
        return;
      }

      const next = stepAttribute(current, attributesRef.current, lifted.id, direction);
      if (next === current) {
        setAnnouncement(
          `${lifted.label} is already at the ${backwards ? 'start' : 'end'} of the profile. ` +
            'It cannot move further.',
        );
        return;
      }
      setDraft(next);
      setAnnouncement(
        `${lifted.label} moved to ${sectionName(next, next.assign[lifted.id] ?? UNCATEGORIZED)}, ` +
          `position ${indexOfAttribute(next, lifted.id) + 1}.`,
      );
    },
    [moveSection],
  );

  // One set of window listeners per pointer session, armed by `beginDrag` and
  // torn down by the drop, the cancel, or unmount — whichever comes first.
  useEffect(() => {
    if (!isPointerSession) return;

    const onMove = (event: globalThis.PointerEvent): void => {
      const press = pending.current;
      if (press) {
        const travelled =
          Math.abs(event.clientX - press.x) + Math.abs(event.clientY - press.y) >= ACTIVATION_PX;
        if (!travelled) return;
        pending.current = null;
        const lifted: EditorDrag = {
          kind: press.kind,
          id: press.id,
          label: labelFor(press.kind, press.id, attributesRef.current, draftRef.current),
          keyboard: false,
        };
        dragRef.current = lifted;
        setDrag(lifted);
      }

      const lifted = dragRef.current;
      if (!lifted) return;
      event.preventDefault();
      setGhost({ x: event.clientX, y: event.clientY });
      const target =
        lifted.kind === 'section'
          ? sectionTargetAt(lifted.id, event.clientY)
          : attributeTargetAt(lifted.id, event.clientY);
      dropTargetRef.current = target;
      setDropTarget(target);
    };

    const onUp = (): void => {
      // A press that never travelled is a click on the handle, not a drag.
      if (pending.current) endSession();
      else drop();
    };

    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cancelDrag();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [cancelDrag, drop, endSession, isPointerSession]);

  return {
    draft,
    sections,
    setOption,
    rename,
    add,
    remove,
    toggleHidden: hide,
    place,
    moveSection,
    commit,
    cancel: onCancel,
    resetToDefault,
    drag,
    dropTarget,
    ghost,
    reducedMotion,
    beginDrag,
    lift,
    step,
    drop,
    cancelDrag,
    announcement,
  };
}
