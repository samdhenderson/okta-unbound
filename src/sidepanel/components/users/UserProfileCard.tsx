/**
 * @module sidepanel/components/users/UserProfileCard
 * @description Presentational card summarizing a single Okta user's profile.
 *
 * Renders the compact {@link UserIdentity} header followed by tabbed detail
 * sections (Account / Organization / Contact / Preferences / Custom) plus an
 * **All** tab — a flat, searchable list of every profile attribute. Sections with
 * no data self-hide. Used by the Users tab.
 */
import React, { useMemo, useState } from 'react';
import type { OktaUser } from '../../../shared/types';
import { Tabs, Input, type TabItem } from '../shared';
import Icon from '../overview/shared/Icon';
import UserIdentity from './UserIdentity';
import {
  getAccountFields,
  getOrgFields,
  getContactFields,
  getPrefsFields,
  getCustomFields,
  getAllFields,
  type ProfileField,
} from './userProfileSections';

/** Props for {@link UserProfileCard}. */
interface UserProfileCardProps {
  /** The user to render. */
  user: OktaUser;
  /** When true (default), renders the tabbed detail sections below the identity header. */
  showCollapsibleSections?: boolean;
  /** Okta origin used to build the "Open in Okta" admin link; the link is hidden when absent. */
  oktaOrigin?: string | null;
  /** Whether to render the identity header's "Open in Okta" deep link. Defaults to `true`. */
  showOktaLink?: boolean;
  /**
   * Optional content rendered between the identity header and the detail sections
   * (e.g. UsersTab's lifecycle-action controls). Renders regardless of
   * `showCollapsibleSections`.
   */
  afterCard?: React.ReactNode;
}

/** A two-column grid of labelled profile field cells. */
const FieldGrid: React.FC<{ fields: ProfileField[] }> = ({ fields }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
    {fields.map((field) => (
      <div key={field.key} className="p-3 bg-white rounded-md border border-neutral-200">
        <span className="text-xs font-medium text-neutral-600 mb-1 block">{field.label}</span>
        <span
          className={`block text-neutral-900 ${field.mono ? 'font-mono text-xs truncate' : 'text-sm'}`}
        >
          {field.value}
        </span>
      </div>
    ))}
  </div>
);

/**
 * Shared user profile card used in the Users tab. Displays the compact identity
 * header, an optional `afterCard` slot, and tabbed detail sections including a
 * searchable "All attributes" view.
 */
const UserProfileCard: React.FC<UserProfileCardProps> = ({
  user,
  showCollapsibleSections = true,
  oktaOrigin,
  showOktaLink = true,
  afterCard,
}) => {
  const sections = useMemo(() => {
    const account = getAccountFields(user);
    const org = getOrgFields(user);
    const contact = getContactFields(user);
    const prefs = getPrefsFields(user);
    const custom = getCustomFields(user);
    const all = getAllFields(user);
    return { account, org, contact, prefs, custom, all };
  }, [user]);

  // Only render tabs that have data (Account + All are always present).
  const tabs = useMemo<TabItem[]>(() => {
    const list: TabItem[] = [{ key: 'account', label: 'Account' }];
    if (sections.org.length) list.push({ key: 'org', label: 'Org' });
    if (sections.contact.length) list.push({ key: 'contact', label: 'Contact' });
    if (sections.prefs.length) list.push({ key: 'prefs', label: 'Prefs' });
    if (sections.custom.length)
      list.push({ key: 'custom', label: 'Custom', count: sections.custom.length });
    list.push({ key: 'all', label: 'All' });
    return list;
  }, [sections]);

  const [activeKey, setActiveKey] = useState('account');
  const [allFilter, setAllFilter] = useState('');

  // Guard against an active tab that disappeared when the user changed.
  const activeExists = tabs.some((t) => t.key === activeKey);
  const currentKey = activeExists ? activeKey : 'account';

  const filteredAll = useMemo(() => {
    const q = allFilter.trim().toLowerCase();
    if (!q) return sections.all;
    return sections.all.filter(
      (f) => f.label.toLowerCase().includes(q) || f.value.toLowerCase().includes(q),
    );
  }, [sections.all, allFilter]);

  return (
    <div className="space-y-4">
      <UserIdentity user={user} oktaOrigin={oktaOrigin} showOktaLink={showOktaLink} />

      {afterCard}

      {showCollapsibleSections && (
        <div className="bg-white rounded-md border border-neutral-200 overflow-hidden">
          <div className="px-2">
            <Tabs
              tabs={tabs}
              activeKey={currentKey}
              onChange={setActiveKey}
              ariaLabel="User profile sections"
            />
          </div>

          <div className="p-4">
            {currentKey === 'account' && <FieldGrid fields={sections.account} />}
            {currentKey === 'org' && <FieldGrid fields={sections.org} />}
            {currentKey === 'contact' && <FieldGrid fields={sections.contact} />}
            {currentKey === 'prefs' && <FieldGrid fields={sections.prefs} />}
            {currentKey === 'custom' && <FieldGrid fields={sections.custom} />}
            {currentKey === 'all' && (
              <div className="space-y-3">
                <Input
                  type="search"
                  value={allFilter}
                  onChange={setAllFilter}
                  placeholder="Filter all attributes…"
                  icon={<Icon type="search" size="sm" />}
                />
                <div className="border border-neutral-200 rounded-md overflow-hidden divide-y divide-neutral-200 max-h-80 overflow-y-auto">
                  {filteredAll.map((field) => (
                    <div
                      key={field.key}
                      className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <span className="text-neutral-500 shrink-0">{field.label}</span>
                      <span
                        className={`font-medium text-neutral-900 text-right break-all ${field.mono ? 'font-mono text-xs' : ''}`}
                      >
                        {field.value}
                      </span>
                    </div>
                  ))}
                  {filteredAll.length === 0 && (
                    <div className="px-3 py-4 text-sm text-neutral-500 text-center">
                      No matching attributes
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileCard;
