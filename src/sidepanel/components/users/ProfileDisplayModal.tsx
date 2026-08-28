/**
 * @module sidepanel/components/users/ProfileDisplayModal
 * @description The "Configure profile display" dialog — where an admin defines
 * their own attribute categories and decides which attributes appear, in which
 * category, in what order.
 *
 * **Controlled, deliberately.** This component never calls
 * {@link module:sidepanel/hooks/useProfileDisplayConfig} itself: it takes the
 * reconciled {@link ProfileDisplayConfig} as a prop and emits every edit as a
 * `Partial<ProfileDisplayConfig>` patch through `onChange`. Two things follow
 * from that. Edits apply **live** to the profile pane behind the dialog rather
 * than on a Save that never existed, and the whole surface is renderable in
 * Storybook and assertable in a test without touching IndexedDB.
 *
 * The shell owns nothing but the tab split. Categories (layout, the display
 * toggles, the admin's category list) and Attributes (per-attribute visibility,
 * placement and order) are two sibling components, because one file carrying
 * both would be well past the ~300-line ceiling in `docs/state-management.md`.
 *
 * Both panels stay mounted and the inactive one is `hidden`, so a filter typed
 * on the Attributes tab survives a trip to Categories and back. `hidden` also
 * takes the panel out of the accessibility tree, so nothing on the tab you
 * cannot see is reachable by keyboard or by a role query.
 *
 * Security: attribute names, values and category labels are all
 * end-user/admin-authored strings. They are rendered through React's escaping
 * and never logged (see `docs/security.md`).
 */
import React, { useMemo, useState } from 'react';
import { Button, Modal, Tabs, type TabItem } from '../shared';
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';
import type { AttributeDescriptor } from './profileAttributes';
import ProfileDisplayCategoriesTab from './ProfileDisplayCategoriesTab';
import ProfileDisplayAttributesTab from './ProfileDisplayAttributesTab';

/** Which half of the dialog is showing. */
type ProfileDisplayTab = 'categories' | 'attributes';

/** Props for {@link ProfileDisplayModal}. */
export interface ProfileDisplayModalProps {
  /** Whether the dialog is open. The shared `Modal` renders nothing when false. */
  isOpen: boolean;
  /** Called on Done, Escape, overlay click, or the header close button. */
  onClose: () => void;
  /**
   * Every attribute on this user's profile, **including the empty ones** — an
   * attribute you cannot see in this list is an attribute you cannot file.
   */
  attributes: AttributeDescriptor[];
  /**
   * The reconciled configuration being edited. Reconciled means every attribute
   * in `attributes` already has an `assign` entry and a slot in `attrOrder`;
   * this component still tolerates a config that does not (a hand-written
   * default), it simply appends the strays in `attributes` order.
   */
  config: ProfileDisplayConfig;
  /**
   * Emits one patch per edit, applied live to the pane behind the dialog. Record
   * patches (`assign`, `hidden`) are always emitted whole rather than as a
   * single changed key, because the store merges a record patch by taking every
   * *known* attribute from the patch alone.
   */
  onChange: (patch: Partial<ProfileDisplayConfig>) => void;
  /** Discards the org's configuration and returns to the shipped defaults. */
  onReset: () => void;
  /**
   * Attribute name → the names of the group rules that read it. Drives the
   * per-row "read by rules" mark and the `Read by rules` filter. Absent means
   * rules have not been loaded, which renders as no marks — never as "no rule
   * reads this".
   */
  ruleReads?: Record<string, string[]>;
}

/**
 * The profile-display configuration dialog: a `Categories` tab for layout,
 * display toggles and the admin's own category list, and an `Attributes` tab for
 * per-attribute visibility, placement and order.
 *
 * @example
 * ```tsx
 * const { config, update, reset } = useProfileDisplayConfig(oktaOrigin, names);
 *
 * <ProfileDisplayModal
 *   isOpen={isConfiguring}
 *   onClose={() => setIsConfiguring(false)}
 *   attributes={attributes}
 *   config={config}
 *   onChange={update}
 *   onReset={reset}
 *   ruleReads={ruleReads}
 * />;
 * ```
 */
const ProfileDisplayModal: React.FC<ProfileDisplayModalProps> = ({
  isOpen,
  onClose,
  attributes,
  config,
  onChange,
  onReset,
  ruleReads,
}) => {
  const [activeTab, setActiveTab] = useState<ProfileDisplayTab>('categories');

  const tabs = useMemo<TabItem[]>(
    () => [
      { key: 'categories', label: 'Categories', count: config.categories.length },
      { key: 'attributes', label: 'Attributes', count: attributes.length },
    ],
    [config.categories.length, attributes.length],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configure profile display"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onReset}>
            Reset to default
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-(--sp-rung)">
        <Tabs
          tabs={tabs}
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as ProfileDisplayTab)}
          ariaLabel="Profile display settings"
        />

        {/* Both panels stay mounted; `hidden` (attribute *and* class) keeps the
            inactive one out of the layout and out of the accessibility tree. */}
        <div
          role="tabpanel"
          aria-label="Categories"
          hidden={activeTab !== 'categories'}
          className={activeTab === 'categories' ? '' : 'hidden'}
        >
          <ProfileDisplayCategoriesTab
            attributes={attributes}
            config={config}
            onChange={onChange}
          />
        </div>

        <div
          role="tabpanel"
          aria-label="Attributes"
          hidden={activeTab !== 'attributes'}
          className={activeTab === 'attributes' ? '' : 'hidden'}
        >
          <ProfileDisplayAttributesTab
            attributes={attributes}
            config={config}
            onChange={onChange}
            ruleReads={ruleReads}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ProfileDisplayModal;
