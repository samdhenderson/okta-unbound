/**
 * @module sidepanel/demo/org
 * @description The fictional org the `Demo/` scenes are filmed against.
 *
 * This module holds only *primitives* — the name pools, the department/title
 * ladder, the id grammar and the deterministic random source. The entities
 * themselves are built in {@link module:sidepanel/demo/users} and
 * {@link module:sidepanel/demo/snapshot}.
 *
 * ## Why a seeded PRNG rather than literals
 *
 * A 250-user org written out by hand is unreadable and undiffable, but
 * `Math.random()` would make every take of a scene show different people —
 * which is fatal for a demo reel that gets re-shot after a UI change and
 * intercut with earlier footage. A small LCG seeded from a constant gives both:
 * the data is generated, and it is byte-identical on every run, in every
 * browser, forever.
 *
 * ## Why none of this is real
 *
 * Every name here is fictional, every address is `@example.com`, and every id
 * carries a `FAKE` infix. No real org data may enter this module — it is
 * checked in, rendered in a public component explorer, and filmed.
 */

/** The fictional company the whole reel portrays. */
export const DEMO_ORG_NAME = 'Northwind Trading Co.';

/**
 * The org origin every demo entity is scoped to.
 *
 * The snapshot store partitions by origin, so this is also the key a scene
 * clears and re-seeds. Matches the origin `.storybook/mocks/chrome.ts` reports
 * for the connected tab, or the Groups tab would read an empty partition.
 */
export const DEMO_ORIGIN = 'https://example.okta.com';

/**
 * A deterministic pseudo-random source (Numerical Recipes LCG).
 *
 * Not cryptographic and not trying to be — it exists so a demo dataset can be
 * generated rather than transcribed while staying identical across runs.
 */
export class SeededRandom {
  private state: number;

  /**
   * @param seed - Any 32-bit integer. The same seed always yields the same
   * sequence, which is the entire point.
   */
  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** The next value in `[0, 1)`. */
  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  /** An integer in `[min, max]`, inclusive at both ends. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** One element of `items`. Throws on an empty array rather than returning `undefined`. */
  pick<T>(items: readonly T[]): T {
    const chosen = items[Math.floor(this.next() * items.length)];
    if (chosen === undefined) throw new Error('SeededRandom.pick: empty array');
    return chosen;
  }

  /** `true` with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }
}

/**
 * Format an Okta-shaped id with a `FAKE` infix.
 *
 * Real Okta ids are a three-character type prefix followed by 17 more, and
 * `shared/utils/oktaId.ts` enforces exactly that: `oktaIdKind` returns `null`
 * for anything of a different length, and the jump bar uses it to decide
 * whether a query is an id at all.
 *
 * **The width is load-bearing, not cosmetic.** These ids were padded to four
 * digits, making them 11 characters, which no code path ever complained about
 * because nothing measured them — until the Home chapter pasted one into the
 * jump bar and the panel classified it as a name search. It found nothing, and
 * it was right to: an 11-character string is not an Okta id. The fixture had
 * been wrong for as long as it had existed and only a feature that validates
 * ids could reveal it.
 *
 * The prefix is kept so anything that branches on it behaves, and the rest
 * stays obviously synthetic.
 *
 * @param prefix - The Okta type prefix, e.g. `00u` for a user.
 * @param n - A per-entity ordinal, zero-padded so `FAKE` plus the digits fill
 * the 17 characters a real id carries after its prefix.
 */
export function fakeId(prefix: string, n: number): string {
  return `${prefix}FAKE${String(n).padStart(13, '0')}`;
}

/** One department and the titles that exist inside it. */
export interface Department {
  /** Display name, as it appears on a user profile and in rule expressions. */
  name: string;
  /** Roughly how many of the org's people sit here, as a relative weight. */
  weight: number;
  /** Titles drawn for members of this department. */
  titles: readonly string[];
}

/**
 * The org chart, as a weighted department ladder.
 *
 * The weights are deliberately lopsided — a real org is mostly two or three
 * departments, and a demo where every department has the same headcount looks
 * generated. Engineering dominating is also what makes the rule-driven groups
 * in {@link module:sidepanel/demo/snapshot} worth previewing.
 */
export const DEPARTMENTS: readonly Department[] = [
  {
    name: 'Engineering',
    weight: 34,
    titles: [
      'Software Engineer',
      'Senior Software Engineer',
      'Staff Engineer',
      'Principal Engineer',
      'Engineering Manager',
      'Site Reliability Engineer',
      'QA Engineer',
    ],
  },
  {
    name: 'Sales',
    weight: 18,
    titles: [
      'Account Executive',
      'Senior Account Executive',
      'Sales Development Rep',
      'Regional Sales Director',
      'Solutions Engineer',
    ],
  },
  {
    name: 'Customer Success',
    weight: 12,
    titles: [
      'Customer Success Manager',
      'Senior Customer Success Manager',
      'Support Engineer',
      'Support Lead',
    ],
  },
  {
    name: 'Marketing',
    weight: 8,
    titles: ['Content Marketer', 'Demand Gen Manager', 'Product Marketing Manager', 'Designer'],
  },
  {
    name: 'Finance',
    weight: 6,
    titles: ['Financial Analyst', 'Controller', 'Accounts Payable Specialist'],
  },
  {
    name: 'People Ops',
    weight: 5,
    titles: ['Recruiter', 'People Partner', 'People Ops Coordinator'],
  },
  {
    name: 'IT',
    weight: 7,
    titles: ['IT Administrator', 'Helpdesk Technician', 'Identity Engineer'],
  },
  {
    name: 'Security',
    weight: 5,
    titles: ['Security Engineer', 'Security Analyst', 'Compliance Manager'],
  },
  { name: 'Legal', weight: 3, titles: ['Corporate Counsel', 'Paralegal'] },
  { name: 'Data', weight: 6, titles: ['Data Analyst', 'Data Engineer', 'Analytics Manager'] },
];

/** Offices, used for `city`/`countryCode` and for the EMEA/AMER rule split. */
export const LOCATIONS: readonly { city: string; state?: string; countryCode: string }[] = [
  { city: 'Seattle', state: 'WA', countryCode: 'US' },
  { city: 'Austin', state: 'TX', countryCode: 'US' },
  { city: 'New York', state: 'NY', countryCode: 'US' },
  { city: 'Toronto', countryCode: 'CA' },
  { city: 'London', countryCode: 'GB' },
  { city: 'Berlin', countryCode: 'DE' },
  { city: 'Dublin', countryCode: 'IE' },
  { city: 'Sydney', countryCode: 'AU' },
];

/** Country codes that fall inside the EMEA rule's scope. */
export const EMEA_COUNTRIES: readonly string[] = ['GB', 'DE', 'IE'];

/** Given-name pool. Deliberately broad so the member lists don't read as one family. */
export const FIRST_NAMES: readonly string[] = [
  'Amara',
  'Priya',
  'Sofia',
  'Mateo',
  'Noor',
  'Kenji',
  'Isla',
  'Omar',
  'Lena',
  'Tomas',
  'Zara',
  'Rafael',
  'Ingrid',
  'Dmitri',
  'Yuki',
  'Farida',
  'Callum',
  'Nadia',
  'Hugo',
  'Aisha',
  'Bjorn',
  'Camila',
  'Dev',
  'Elif',
  'Fiona',
  'Gabriel',
  'Hana',
  'Ivan',
  'Jolene',
  'Kwame',
  'Liwei',
  'Marta',
  'Nikolai',
  'Olive',
  'Pedro',
  'Quinn',
  'Rosa',
  'Sanjay',
  'Tariq',
  'Ursula',
  'Viktor',
  'Wren',
  'Xiomara',
  'Yusuf',
  'Zoe',
  'Anders',
  'Beatriz',
  'Cyrus',
  'Delphine',
  'Emeka',
  'Freya',
  'Giovanni',
  'Halima',
  'Ines',
  'Jonas',
  'Keiko',
];

/** Family-name pool. */
export const LAST_NAMES: readonly string[] = [
  'Okonkwo',
  'Nakamura',
  'Vasquez',
  'Lindqvist',
  'Haddad',
  'Petrov',
  'Silva',
  'Bergman',
  'Adeyemi',
  'Kowalski',
  'Moreau',
  'Rossi',
  'Andersen',
  'Fitzgerald',
  'Novak',
  'Rahman',
  'Castellanos',
  'Bianchi',
  'Volkov',
  'Mbeki',
  'Larsen',
  'Ferreira',
  'Dubois',
  'Kaur',
  'Sandoval',
  'Weber',
  'Iqbal',
  'Marchetti',
  'Nilsson',
  'Osei',
  'Delgado',
  'Hoffmann',
  'Tanaka',
  'Brennan',
  'Achterberg',
  'Villanueva',
  'Sorensen',
  'Chaudhry',
  'Romano',
  'Eriksen',
  'Barbosa',
  'Yamamoto',
  'Kovacs',
  'Mensah',
  'Reyes',
  'Schneider',
  'Oyelaran',
  'Bakker',
];

/**
 * Pick a department by weight.
 *
 * @param rng - The seeded source, so a run is reproducible.
 */
export function pickDepartment(rng: SeededRandom): Department {
  const total = DEPARTMENTS.reduce((sum, d) => sum + d.weight, 0);
  let roll = rng.next() * total;
  let last = DEPARTMENTS[0];
  for (const dept of DEPARTMENTS) {
    last = dept;
    roll -= dept.weight;
    if (roll <= 0) return dept;
  }
  // Unreachable while DEPARTMENTS is non-empty; returning the last visited
  // entry keeps the signature total without a non-null assertion.
  if (!last) throw new Error('DEPARTMENTS is empty');
  return last;
}

/**
 * An ISO timestamp `daysAgo` days before the dataset's fixed "now".
 *
 * Anchored to a constant rather than `Date.now()` for the same reason the PRNG
 * is seeded: two takes filmed a week apart must show the same dates.
 */
export function isoDaysAgo(daysAgo: number): string {
  const anchor = Date.UTC(2026, 7, 1, 9, 0, 0);
  return new Date(anchor - daysAgo * 86_400_000).toISOString();
}
