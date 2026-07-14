import React, { useMemo, useState } from 'react';
import type { OktaUser } from '../../../../shared/types';
import Modal from '../../shared/Modal';
import Button from '../../shared/Button';
import CopyButton from '../../shared/CopyButton';
import { memberFullName } from './memberAnalytics';

interface CopyMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The members to copy (already filtered/sorted by the caller). */
  members: OktaUser[];
}

type FormatId = 'name' | 'email' | 'login' | 'nameEmail';

interface Format {
  id: FormatId;
  label: string;
  hint: string;
  get: (user: OktaUser) => string;
}

const FORMATS: Format[] = [
  { id: 'name', label: 'Full name', hint: 'Jane Doe', get: (u) => memberFullName(u) },
  {
    id: 'email',
    label: 'Email',
    hint: 'jane.doe@acme.com',
    get: (u) => u.profile.email || u.profile.login,
  },
  { id: 'login', label: 'Username', hint: 'Okta login', get: (u) => u.profile.login },
  {
    id: 'nameEmail',
    label: 'Name and email',
    hint: 'Jane Doe <jane.doe@acme.com>',
    get: (u) => {
      const name = memberFullName(u);
      const email = u.profile.email || u.profile.login;
      return name ? `${name} <${email}>` : email;
    },
  },
];

const PREVIEW_LINES = 12;

/**
 * Lets the user pick what identifier to copy for the current member list (name,
 * email, username, or "name <email>") and copies one per line, with a live preview.
 */
const CopyMembersModal: React.FC<CopyMembersModalProps> = ({ isOpen, onClose, members }) => {
  const [formatId, setFormatId] = useState<FormatId>('email');
  const format = FORMATS.find((f) => f.id === formatId) ?? FORMATS[0];

  const lines = useMemo(
    () => (isOpen ? members.map(format.get).filter((s) => s.trim() !== '') : []),
    [isOpen, members, format],
  );
  const text = useMemo(() => lines.join('\n'), [lines]);

  const count = lines.length;
  const preview = lines.slice(0, PREVIEW_LINES);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Copy members"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <CopyButton
            getText={() => text}
            label={`Copy ${count.toLocaleString()} ${count === 1 ? 'member' : 'members'}`}
            copiedLabel="Copied"
            variant="primary"
            size="md"
            disabled={count === 0}
            title="Copy one per line"
          />
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-600">Copy as</label>
          <div className="grid grid-cols-2 gap-2">
            {FORMATS.map((f) => {
              const active = f.id === formatId;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormatId(f.id)}
                  aria-pressed={active}
                  className={`flex items-start gap-2.5 rounded-md border p-2.5 text-left transition-colors duration-100 ${
                    active
                      ? 'border-primary bg-primary-light'
                      : 'border-neutral-200 bg-white hover:border-neutral-400'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                      active ? 'border-primary' : 'border-neutral-300'
                    }`}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block text-sm font-medium ${active ? 'text-primary-text' : 'text-neutral-900'}`}
                    >
                      {f.label}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">{f.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className="text-xs font-medium text-neutral-600">Preview</label>
            <span className="text-xs text-neutral-500 tabular-nums">
              {count.toLocaleString()} {count === 1 ? 'line' : 'lines'}
            </span>
          </div>
          {count === 0 ? (
            <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-500">
              No members to copy.
            </p>
          ) : (
            <div className="max-h-44 overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-neutral-700">
                {preview.join('\n')}
                {count > PREVIEW_LINES && (
                  <span className="text-neutral-400">{`\n…and ${(count - PREVIEW_LINES).toLocaleString()} more`}</span>
                )}
              </pre>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CopyMembersModal;
