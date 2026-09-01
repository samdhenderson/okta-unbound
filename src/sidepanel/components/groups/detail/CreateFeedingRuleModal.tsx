/**
 * @module sidepanel/components/groups/detail/CreateFeedingRuleModal
 * @description The confirm step for the Group Detail rung's *Create feeding rule* verb.
 *
 * A pure view over {@link module:sidepanel/hooks/useCreateFeedingRule}: the two
 * draft fields (rule name, match expression), the plain-language statement of
 * what a rule does that a second press cannot take back, and the confirm/cancel
 * footer. Every control comes from the shared barrel, and the dialog mechanics —
 * `role="dialog"`, `aria-modal`, focus trap, focus restore, Escape — are the
 * shared `Modal`'s.
 *
 * ## Three things it says, and why each is there
 *
 * 1. **The consequence.** "A rule grants memberships as it matches, and deleting
 *    it later does not take those memberships back." ADR-0039 asks an
 *    irreversible verb to name what changes and the state it leaves behind, not
 *    to restate its own label.
 * 2. **The mitigation, stated rather than assumed.** Okta creates a rule
 *    `INACTIVE`; nobody is added until it is activated. Leaving that out would
 *    make the consequence read as immediate, which it is not.
 * 3. **What is not predicted.** How many people the rule will place in the group
 *    is *not predicted here*, and the sentence says why (this rung has evaluated
 *    the expression against nobody; Okta decides who matches, applies rules
 *    asynchronously, and honours exclusions this panel cannot see). Under
 *    ADR-0036 a withheld prediction is a peer of an answer and always carries
 *    its reason — a count invented from an inventory we do not hold would be the
 *    assertion that ADR forbids.
 *
 * The expression notice is `warning`, never `danger`, and never disables the
 * confirm: this panel parses a documented subset of Okta EL, so "could not read
 * that" is a fact about the panel and not a verdict on the rule (ADR-0017).
 *
 * On success the dialog does not simply close. It reports the created rule and
 * offers the jump to it, because activating it is a separate, deliberate step
 * and the reader is the one who has to take it.
 */
import React from 'react';
import { AlertMessage, Button, Input, Modal, Textarea } from '../../shared';

/** Props for {@link CreateFeedingRuleModal}. */
export interface CreateFeedingRuleModalProps {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** The group the drafted rule assigns users into; named in the title and the consequence copy. */
  groupName: string;
  /** Controlled rule-name draft. */
  name: string;
  /** Called with the new rule name on each keystroke. */
  onNameChange: (value: string) => void;
  /** Why the drafted name is unacceptable (length), or `null`. */
  nameError: string | null;
  /** Controlled match-expression draft. */
  expression: string;
  /** Called with the new expression on each keystroke. */
  onExpressionChange: (value: string) => void;
  /** Non-blocking notice about an expression this panel could not parse, or `null`. */
  expressionNotice: string | null;
  /** Whether the confirm button may fire. */
  canSubmit: boolean;
  /** True while the create request is in flight (drives the confirm spinner). */
  isCreating: boolean;
  /** Message from a failed create, or `null`. */
  error: string | null;
  /** The created rule's name once the write landed, or `null`. Switches the dialog to its success step. */
  createdRuleName: string | null;
  /** The created rule's id once the write landed, or `null`. */
  createdRuleId: string | null;
  /** Close the dialog and discard the draft. */
  onClose: () => void;
  /** Run the create. */
  onConfirm: () => void;
  /**
   * Deep-links the created rule in the Rules tab, where it is activated. Absent
   * on a surface with no Rules tab to jump to, in which case no jump control is
   * rendered rather than a dead one (ADR-0039).
   */
  onNavigateToRule?: (ruleId: string) => void;
}

/**
 * The create-feeding-rule dialog: draft, consequence, confirm — then the created
 * rule and the way to activate it.
 *
 * @param props - See {@link CreateFeedingRuleModalProps}.
 */
const CreateFeedingRuleModal: React.FC<CreateFeedingRuleModalProps> = ({
  isOpen,
  groupName,
  name,
  onNameChange,
  nameError,
  expression,
  onExpressionChange,
  expressionNotice,
  canSubmit,
  isCreating,
  error,
  createdRuleName,
  createdRuleId,
  onClose,
  onConfirm,
  onNavigateToRule,
}) => {
  const created = createdRuleName !== null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={created ? 'Rule created' : `Create a rule that feeds ${groupName}`}
      size="md"
      footer={
        created ? (
          <div className="flex justify-end gap-2">
            {createdRuleId && onNavigateToRule && (
              <Button
                variant="secondary"
                size="sm"
                icon="external-link"
                onClick={() => onNavigateToRule(createdRuleId)}
              >
                Open in Rules tab
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onConfirm}
              disabled={!canSubmit}
              loading={isCreating}
            >
              Create rule
            </Button>
          </div>
        )
      }
    >
      {created ? (
        <div className="space-y-(--sp-field)">
          <p className="text-sm text-neutral-700">
            <strong className="text-neutral-900">{createdRuleName}</strong> now targets{' '}
            <strong className="text-neutral-900">{groupName}</strong>, and it is{' '}
            <strong className="text-neutral-900">inactive</strong>. Nobody has been added.
          </p>
          <p className="text-xs text-neutral-600">
            Activating it is what starts the grants — and what cannot be undone by deactivating it
            again.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            label="Rule name"
            value={name}
            onChange={onNameChange}
            placeholder="Engineering intake"
            {...(nameError ? { error: nameError } : { hint: 'Must be unique across the org.' })}
          />

          <Textarea
            label="Match expression"
            value={expression}
            onChange={onExpressionChange}
            rows={3}
            placeholder={'user.department == "Engineering"'}
            hint="Okta Expression Language, evaluated against each user's profile."
          />

          {expressionNotice && (
            <AlertMessage message={{ text: expressionNotice, type: 'warning' }} />
          )}

          {/*
            The consequence, the mitigation and the withheld prediction, in that
            order — see the module doc for why each one is here.
          */}
          <div className="space-y-(--sp-field) rounded-md border border-neutral-200 p-(--sp-card)">
            <p className="text-xs text-danger-text">
              A rule grants memberships as it matches, and deleting it later does not take those
              memberships back. Removing them is a separate job, one member at a time.
            </p>
            <p className="text-xs text-neutral-600">
              Okta creates the rule <strong className="text-neutral-900">inactive</strong>, so
              nobody is added until you activate it.
            </p>
            <p className="text-xs text-neutral-600">
              How many people this would add to {groupName} is{' '}
              <strong className="text-neutral-900">not predicted here</strong>: this panel has not
              evaluated the expression against your org&rsquo;s users. Okta decides who matches,
              applies rules asynchronously, and honours exclusions this panel cannot see.
            </p>
          </div>

          {error && <AlertMessage message={{ text: error, type: 'danger' }} />}
        </div>
      )}
    </Modal>
  );
};

export default CreateFeedingRuleModal;
