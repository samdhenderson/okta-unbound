/**
 * @module sidepanel/components/users/profileEditability
 * @description Decides whether one profile attribute may be edited here — and,
 * when it may not, says why in a sentence an admin can act on.
 *
 * No React and no I/O, like
 * {@link module:sidepanel/components/users/profileAttributes}: a descriptor and a
 * user in, a verdict out. Both editing surfaces (the Profile pane and the
 * two-user Compare view) ask this module rather than each deciding for itself,
 * because two copies of the gate would eventually disagree about the same
 * attribute on the same screen.
 *
 * ## The gate is deny-by-default
 *
 * Every branch that cannot *prove* an attribute is writable locks it. Okta's
 * schema fields (`mutability`, `type`, `master.type`) are `z.string()` rather than
 * enums on purpose — a value from a future Okta release must survive validation —
 * so an unrecognized value arrives here as a plain string and is treated as a
 * reason to lock, never as a reason to open. The cost of a wrong lock is an admin
 * making the change in the Okta console; the cost of a wrong unlock is a failed
 * write, or a silently-reverted one at the next profile-master import.
 *
 * ## Mastering is a per-user fact, not an org-wide one
 *
 * `master.type: 'PROFILE_MASTER'` on a schema property does **not** mean "every
 * user's copy of this attribute is owned elsewhere". It means "whichever of the
 * sources in `master.priority` this user is attached to owns it" — and a user
 * attached to *none* of them is Okta-mastered for that attribute and editable in
 * the Okta console. Reading the schema alone and locking the attribute for the
 * whole org is therefore wrong in exactly the orgs that have a profile source at
 * all: it locks the HR-sourced attributes of every user the HR app has never
 * heard of.
 *
 * The per-user half of the answer is {@link ProfileMastering} — the apps the user
 * is actually assigned to, which is what `master.priority` names (AD and LDAP are
 * app instances too). It stays deny-by-default: the attribute only unlocks when
 * the priority list is fully understood **and** the user's app list has loaded
 * **completely**. A partial list cannot prove an absence, and an absence is the
 * whole claim being made.
 *
 * ## Copy
 *
 * The `explanation` sentences follow the tone of
 * {@link module:shared/rules/unevaluableReasonText}: complete sentences, plainly
 * stated, never blaming the reader, and never implying the attribute is broken
 * when it is merely owned elsewhere.
 *
 * Security: attribute names, labels and mastering source names are org data.
 * Nothing here logs, and every string it emits is rendered through React's
 * escaping by {@link module:sidepanel/components/users/ProfileEditCell}.
 */
import type { OktaUser } from '../../../shared/types';
import type { OktaUserSchemaProperty } from '../../../shared/schemas/okta';
import type { AttributeDescriptor } from './profileAttributes';

/** The kind of control an editable attribute is rendered with. */
export type EditControl = 'text' | 'number' | 'select' | 'checkbox';

/**
 * Why an attribute cannot be edited here.
 *
 * - `system` — a top-level user field (`id`, `status`, a lifecycle timestamp);
 *   not part of `user.profile` and not a profile attribute at all.
 * - `read-only` — Okta reports the attribute as read-only, or reports a
 *   mutability this panel does not recognize.
 * - `write-only` — Okta accepts a value but never returns one, so there is no
 *   before-value to edit against.
 * - `externally-mastered` — the attribute's own `master` block names a source
 *   other than Okta; a write here would be overwritten at the next import.
 * - `account-mastered` — the *account's* credentials are mastered outside Okta,
 *   which is what decides `login`.
 * - `unsupported-type` — an array or object attribute (a repeater UI this panel
 *   does not have), or a type it cannot identify.
 * - `not-in-schema` — the org's schema never described the attribute, so its
 *   type, mutability and mastering are all unknown.
 */
export type LockReason =
  | 'system'
  | 'read-only'
  | 'write-only'
  | 'externally-mastered'
  | 'account-mastered'
  | 'unsupported-type'
  | 'not-in-schema';

/**
 * What is known about the profile sources attached to **this** user.
 *
 * Supplied by the surface rather than fetched here (this module does no I/O), and
 * cheap on both surfaces: it is the app-assignment list the Users tab's Apps pane
 * and the comparison's app analysis already walk, read through the same cache key.
 */
export interface ProfileMastering {
  /**
   * App id → display label, for every app this user is assigned to.
   *
   * **`undefined` is not "no apps".** It means the list has not loaded, or the
   * pagination walk did not finish — in which case nothing can be proven absent
   * from it and every externally-mastered attribute stays locked. Pass an empty
   * map only for a completed walk that genuinely returned nothing.
   */
  readonly assignedApps?: ReadonlyMap<string, string>;
}

/**
 * Build a {@link ProfileMastering} from an app-assignment walk.
 *
 * @param apps - The assignments, or `undefined` when none have loaded.
 * @param complete - Whether the pagination walk finished. `false` discards the
 *   rows: a partial list is indistinguishable from a shorter one, and the only
 *   question asked of it is whether an app is *missing*.
 * @returns A context safe to hand to {@link attributeEditability}.
 *
 * @example
 * ```ts
 * const mastering = profileMastering(appsQuery.data?.apps, appsQuery.data?.complete ?? false);
 * ```
 */
export function profileMastering(
  apps: readonly { readonly id: string; readonly label: string }[] | undefined,
  complete: boolean,
): ProfileMastering {
  if (apps === undefined || !complete) return {};
  return { assignedApps: new Map(apps.map((app) => [app.id, app.label])) };
}

/** One choice of a `select`-rendered attribute. */
export interface EditOption {
  /** The value written back to Okta. */
  value: string;
  /** The visible text — the schema's `oneOf` title when it supplied one. */
  label: string;
}

/**
 * The verdict for one attribute: either how to edit it, or why it is locked.
 *
 * A discriminated union rather than an `editable` flag beside optional fields, so
 * a caller cannot read `control` without having established that there is one.
 */
export type AttributeEditability =
  | {
      readonly editable: true;
      /** Which control renders it. */
      readonly control: EditControl;
      /** The allowed choices, present only when `control` is `select`. */
      readonly options?: readonly EditOption[];
      /** Whether Okta requires a value — an emptied field is a validation error. */
      readonly required: boolean;
    }
  | {
      readonly editable: false;
      /** Which gate closed. */
      readonly reason: LockReason;
      /** A complete sentence for the UI, safe to render as-is. */
      readonly explanation: string;
      /** The mastering system, named, when that is why the attribute is locked. */
      readonly source?: string;
    };

/**
 * The one `master.type` / `credentials.provider.type` value that means "Okta owns
 * this".
 *
 * Okta's schema documents `master.type` as `PROFILE_MASTER` (an external app,
 * AD or LDAP owns the attribute), `OVERRIDE`, or `OKTA`; `credentials.provider.type`
 * as `OKTA`, `ACTIVE_DIRECTORY`, `LDAP`, `IMPORT` or `FEDERATION`. Both sets can
 * grow, and neither is validated as an enum at the boundary, so this module
 * matches the **one** value that permits a write and treats every other value —
 * recognized or not — as external.
 */
const OKTA_MASTER = 'OKTA';

/**
 * The one `master.type` whose scope is decided per user, by `master.priority`.
 *
 * Every other non-{@link OKTA_MASTER} value — `OVERRIDE`, or anything a future
 * Okta release adds — locks unconditionally: this module knows what
 * `PROFILE_MASTER` means and declines to guess at the rest.
 */
const PROFILE_MASTER = 'PROFILE_MASTER';

/** The `master.priority` entry kind this module can check a user against. */
const APP_PRIORITY_SOURCE = 'APP';

/** The attribute whose editability the account's credential provider decides. */
const LOGIN_ATTRIBUTE = 'login';

/** `ACTIVE_DIRECTORY` → `Active Directory`; an unrecognized token still reads as prose. */
function humanizeSource(token: string): string {
  const words = token
    .split(/[_\s-]+/)
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  return words.length > 0 ? words.join(' ') : token;
}

/** A locked verdict, with the mastering source attached when there is one. */
function locked(reason: LockReason, explanation: string, source?: string): AttributeEditability {
  return source === undefined
    ? { editable: false, reason, explanation }
    : { editable: false, reason, explanation, source };
}

/** Every entry of a `oneOf` list projected to an option, or `undefined` if any entry does not fit. */
function oneOfOptions(entries: readonly unknown[]): EditOption[] | undefined {
  const options: EditOption[] = [];
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') return undefined;
    const record = entry as { const?: unknown; title?: unknown };
    if (typeof record.const !== 'string') return undefined;
    const label =
      typeof record.title === 'string' && record.title !== '' ? record.title : undefined;
    options.push({ value: record.const, label: label ?? String(record.const) });
  }
  return options.length > 0 ? options : undefined;
}

/** Every entry of an `enum` list projected to an option, or `undefined` if any entry is not a string. */
function enumOptions(entries: readonly unknown[]): EditOption[] | undefined {
  const options: EditOption[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'string') return undefined;
    options.push({ value: entry, label: entry });
  }
  return options.length > 0 ? options : undefined;
}

/**
 * The choices for a string attribute, or `undefined` when it is free text.
 *
 * `oneOf` wins over `enum` because it is the labelled form: Okta emits both for
 * the same attribute, and only `oneOf` carries the human titles.
 */
function selectOptions(property: OktaUserSchemaProperty): EditOption[] | undefined {
  if (property.oneOf !== undefined) {
    const labelled = oneOfOptions(property.oneOf);
    if (labelled !== undefined) return labelled;
  }
  if (property.enum !== undefined) return enumOptions(property.enum);
  return undefined;
}

/**
 * Which control a schema property's `type` maps to, or `undefined` when this
 * panel does not edit that type.
 *
 * Exported because {@link module:sidepanel/components/users/profileDraft} must
 * coerce a draft string back through the *same* mapping the gate used to render
 * the control. Deriving it twice is how `5` and `'5'` come to disagree.
 *
 * @param property - The attribute's schema property, or `undefined` when the
 *   schema never described it.
 * @returns The control, or `undefined` for `array`, `object`, an absent type, or
 *   a type string this panel does not recognize.
 */
export function editControlFor(
  property: OktaUserSchemaProperty | undefined,
): EditControl | undefined {
  if (property === undefined) return undefined;
  switch (property.type) {
    case 'string':
      return selectOptions(property) === undefined ? 'text' : 'select';
    case 'boolean':
      return 'checkbox';
    case 'number':
    case 'integer':
      return 'number';
    default:
      return undefined;
  }
}

/** The sentence for a `mutability` this panel will not write. */
function mutabilityLock(mutability: string): AttributeEditability {
  if (mutability === 'READ_ONLY') {
    return locked(
      'read-only',
      'Okta reports this attribute as read-only, so it is changed elsewhere.',
    );
  }
  if (mutability === 'WRITE_ONLY') {
    return locked(
      'write-only',
      'Okta accepts a value for this attribute but never returns one, so there is nothing here to edit against.',
    );
  }
  return locked(
    'read-only',
    'Okta reports a mutability this panel does not recognize, so the attribute is treated as read-only.',
  );
}

/** One entry of a schema property's `master.priority` list. */
interface MasterPriorityEntry {
  /** Source kind — `APP` for an app instance, which is all this module checks. */
  readonly type: string;
  /** The source's id; for `APP`, an Okta app instance id. */
  readonly value: string;
}

/**
 * `master.priority` narrowed, or `undefined` when it is absent, empty, or not the
 * shape this module knows.
 *
 * The schema types it as `z.unknown()` on purpose (ADR-0006 keeps the boundary
 * lenient so an unfamiliar payload survives validation), so the narrowing has to
 * happen at the reader. `undefined` from here means "cannot be checked", which
 * the caller turns into a lock — never into an unlock.
 */
function masterPriority(raw: unknown): MasterPriorityEntry[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;

  const entries: MasterPriorityEntry[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') return undefined;
    const record = entry as { type?: unknown; value?: unknown };
    if (typeof record.type !== 'string' || typeof record.value !== 'string') return undefined;
    entries.push({ type: record.type, value: record.value });
  }
  return entries;
}

/**
 * Whether an external system masters this attribute **for this user**, or
 * `undefined` when Okta owns it and the gate should carry on.
 *
 * See the module header: the schema's `master` block describes the org, and the
 * user's app assignments are what turn it into a fact about one person. Every
 * step that cannot complete the check falls back to the unconditional lock.
 */
function masteringLock(
  property: OktaUserSchemaProperty,
  mastering: ProfileMastering | undefined,
): AttributeEditability | undefined {
  const master = property.master;
  const type = master?.type;
  if (type === undefined || type === OKTA_MASTER) return undefined;

  if (type !== PROFILE_MASTER) {
    const source = humanizeSource(type);
    return locked(
      'externally-mastered',
      `An external system masters this attribute (${source}), so a change made here would be overwritten at the next import.`,
      source,
    );
  }

  // `PROFILE_MASTER` with nothing checkable behind it: the org says an external
  // source owns this attribute and this panel cannot say whether that source
  // reaches this user, so it assumes it does.
  const unresolved = locked(
    'externally-mastered',
    'A profile source outside Okta masters this attribute, so a change made here would be overwritten at the next import.',
  );

  const priority = masterPriority(master?.priority);
  if (priority === undefined) return unresolved;
  // A source kind this module cannot test a user against makes the whole list
  // unanswerable — a "no match" over the entries it *does* understand would be a
  // confident wrong answer about the ones it does not.
  if (priority.some((entry) => entry.type !== APP_PRIORITY_SOURCE)) return unresolved;

  const assigned = mastering?.assignedApps;
  if (assigned === undefined) return unresolved;

  const applied = priority.find((entry) => assigned.has(entry.value));
  // The org masters this attribute from sources this user is attached to none of.
  // Okta owns their copy, and so may this panel.
  if (applied === undefined) return undefined;

  const appName = assigned.get(applied.value);
  return appName === undefined || appName === ''
    ? unresolved
    : locked(
        'externally-mastered',
        `${appName} is this user's profile source for this attribute, so a change made here would be overwritten at the next import.`,
        appName,
      );
}

/** The sentence for a type this panel has no control for. */
function typeLock(type: string | undefined): AttributeEditability {
  if (type === undefined || type === '') {
    return locked(
      'unsupported-type',
      "The org's schema does not say what type this attribute holds, so this panel does not edit it.",
    );
  }
  return locked('unsupported-type', `This panel does not edit ${type} attributes.`);
}

/**
 * Whether one attribute of one user may be edited here.
 *
 * The gates run in order and the first match wins:
 *
 * 1. A `system` attribute is not a profile attribute at all.
 * 2. An attribute the org's schema never described is one this panel declines to
 *    blind-write.
 * 3. **`login`** is a credential rather than an ordinary attribute, so the
 *    *account's* `credentials.provider.type` decides it — a per-attribute `master`
 *    block cannot answer the question. An **absent** provider type locks it: an
 *    absence is not a confirmation that Okta owns the credential. There is
 *    deliberately no blanket deny-list here — when the provider is `OKTA`,
 *    `login` is editable. The account gate is additive: `login` still passes
 *    through the mutability, mastering and type gates below, so it can only end
 *    up more locked than another attribute, never less.
 * 4. `mutability` — anything that is not `READ_WRITE` locks, including a value
 *    this panel does not recognize.
 * 5. `master.type` — anything that is not {@link OKTA_MASTER} and not absent is
 *    an external master, and a write here would be overwritten at the next
 *    import. A `PROFILE_MASTER` block is the one case resolved **per user**: it
 *    locks only when this user is assigned to one of the apps in its
 *    `master.priority`, which requires `mastering` to carry a complete app list.
 *    Without one, it locks anyway.
 * 6. `type` — `string` (free text, or a `select` when the schema enumerates the
 *    values), `boolean`, `number`/`integer`. An `array` or `object` attribute
 *    needs a repeater UI this panel does not have.
 *
 * @param attribute - The descriptor from `allProfileAttributes`, carrying its
 *   schema `property` when the org's schema described it.
 * @param user - The user being edited; read only for `credentials.provider`.
 * @param mastering - What is known about the profile sources attached to this
 *   user. Omitting it is safe and conservative — every `PROFILE_MASTER`
 *   attribute simply stays locked, which is what this gate did before the
 *   per-user check existed.
 * @returns How to edit the attribute, or why it is locked.
 *
 * @example
 * ```ts
 * const verdict = attributeEditability(descriptor, user);
 * if (verdict.editable) render(verdict.control);
 * else explain(verdict.explanation);
 * ```
 */
export function attributeEditability(
  attribute: AttributeDescriptor,
  user: OktaUser,
  mastering?: ProfileMastering,
): AttributeEditability {
  if (attribute.kind === 'system') {
    return locked(
      'system',
      'This is an account field rather than a profile attribute, so it is not edited here.',
    );
  }

  const property = attribute.property;
  if (property === undefined) {
    return locked(
      'not-in-schema',
      "The org's profile schema does not describe this attribute, so this panel will not write to it.",
    );
  }

  if (attribute.name === LOGIN_ATTRIBUTE) {
    const provider = user.credentials?.provider?.type;
    if (provider === undefined || provider === '') {
      return locked(
        'account-mastered',
        'This panel could not confirm that Okta masters this account, so the sign-in name is changed in the Okta console instead.',
      );
    }
    if (provider !== OKTA_MASTER) {
      const source = humanizeSource(provider);
      return locked(
        'account-mastered',
        `This account is mastered by ${source}, so the sign-in name is changed there rather than here.`,
        source,
      );
    }
  }

  if (property.mutability !== undefined && property.mutability !== 'READ_WRITE') {
    return mutabilityLock(property.mutability);
  }

  const mastered = masteringLock(property, mastering);
  if (mastered !== undefined) return mastered;

  const control = editControlFor(property);
  if (control === undefined) return typeLock(property.type);

  const options = control === 'select' ? selectOptions(property) : undefined;
  const required = Boolean(property.required);

  return options === undefined
    ? { editable: true, control, required }
    : { editable: true, control, options, required };
}
