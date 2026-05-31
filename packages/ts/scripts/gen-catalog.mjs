#!/usr/bin/env node
// @ts-check
/**
 * Catalog code generator.
 *
 * Reads source data files from the zyins engine and the platform schemas,
 * emits typed TypeScript catalogs under `src/catalog/`. Idempotent: same
 * input bytes produce byte-identical output.
 *
 * Run via `npm run gen:catalog` (executed automatically before `build`).
 *
 * Sources are discovered relative to the monorepo layout; missing sources
 * cause the matching catalog to be emitted empty-but-typed and the gap
 * is reported on stderr.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_TS = resolve(__dirname, '..');
const CATALOG_DIR = join(REPO_TS, 'src', 'catalog');

// Resolve the platform repo (the workspace containing this package). When
// the generator runs outside the monorepo layout, callers must provide
// SDK_PLATFORM_REPO / SDK_INSURANCE_REPO overrides.
const DEFAULT_PLATFORM = resolve(REPO_TS, '..', '..');
const PLATFORM_REPO = process.env.SDK_PLATFORM_REPO
  ? resolve(process.env.SDK_PLATFORM_REPO)
  : DEFAULT_PLATFORM;

// Insurance repo holds the engine reference-data artifacts (v2_*.json).
// Default sibling of the platform repo; override via SDK_INSURANCE_REPO.
const DEFAULT_INSURANCE = resolve(PLATFORM_REPO, '..', 'insurance');
const INSURANCE_REPO = process.env.SDK_INSURANCE_REPO
  ? resolve(process.env.SDK_INSURANCE_REPO)
  : DEFAULT_INSURANCE;

const HEADER = (sources) => `/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by \`packages/ts/scripts/gen-catalog.mjs\`.
 * Regenerate with \`npm run gen:catalog\` (runs automatically before \`build\`).
 *
 * Source data:
${sources.map((s) => ` *   - ${s}`).join('\n')}
 */
`;

const gaps = [];

/** Read a JSON file, returning null on miss. */
function tryReadJson(p) {
  try {
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    process.stderr.write(`gen-catalog: failed to read ${p}: ${e.message}\n`);
    return null;
  }
}

function tryReadText(p) {
  try {
    if (!existsSync(p)) return null;
    return readFileSync(p, 'utf8');
  } catch (e) {
    process.stderr.write(`gen-catalog: failed to read ${p}: ${e.message}\n`);
    return null;
  }
}

/** Convert an arbitrary string to a PascalCase TypeScript identifier. */
function pascal(s) {
  return s
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => (w.length === 0 ? '' : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
}

/** Convert a carrier display name to a slug. */
function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function writeFile(name, content) {
  const out = join(CATALOG_DIR, name);
  writeFileSync(out, content);
  process.stderr.write(`gen-catalog: wrote ${out}\n`);
}

// ---------------------------------------------------------------------------
// Products + Carriers
// ---------------------------------------------------------------------------

function genProducts() {
  const path = join(INSURANCE_REPO, 'v2_products.json');
  const raw = tryReadJson(path);
  const sources = ['insurance/v2_products.json'];

  if (!raw) {
    gaps.push('Products: v2_products.json not found — emitting empty catalog.');
    writeFile('products.ts', HEADER(sources) + emptyProductsModule());
    writeFile('carriers.ts', HEADER(sources) + emptyCarriersModule());
    return { products: [], carriers: [] };
  }

  const products = [];
  for (const [cls, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    for (const p of list) {
      if (!p || typeof p !== 'object') continue;
      const identifier = String(p.identifier || '');
      if (!identifier) continue;
      products.push({
        slug: identifier,
        productClass: cls,
        carrierDisplay: String(p.carrier || ''),
        carrierSlug: slugify(String(p.carrier || '')),
        displayName: String(p.name || ''),
        stateVariations: Array.isArray(p.state_variations) ? p.state_variations : [],
      });
    }
  }
  products.sort((a, b) => a.slug.localeCompare(b.slug));

  const enumMembers = products
    .map((p) => `  ${pascal(p.slug)} = '${p.slug}',`)
    .join('\n');

  const metadataEntries = products
    .map(
      (p) =>
        `  '${p.slug}': { slug: '${p.slug}', displayName: ${JSON.stringify(p.displayName)}, carrier: '${p.carrierSlug}', productClass: '${p.productClass}', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: ${JSON.stringify(p.stateVariations)} },`,
    )
    .join('\n');

  const productsModule = `${HEADER(sources)}
/**
 * Product slug enum. Each member's value is the canonical product identifier
 * the platform uses in URLs and reference-data lookups.
 *
 * \`ages\`, \`states\`, and \`faceAmount\` ranges are placeholders today —
 * the upstream catalog does not expose per-product underwriting bounds in a
 * stable, public-facing form. Treat them as advisory zeros until the engine
 * publishes a normalized catalog dump (tracked separately).
 */
export enum Product {
${enumMembers}
}

/** Public metadata for a single \`Product\`. */
export interface ProductMetadata {
  readonly slug: string;
  readonly displayName: string;
  /** Carrier slug. Look up display name via \`ProductCarriers.metadata\`. */
  readonly carrier: string;
  /** Product class: \`fex\`, \`term\`, \`medsup\`, \`preneed\`, etc. */
  readonly productClass: string;
  readonly ages: { readonly min: number; readonly max: number };
  /** ISO 2-letter state codes the product is filed in. */
  readonly states: readonly string[];
  readonly faceAmount: { readonly min: number; readonly max: number };
  /** Display-name variants used for state-specific product filings. */
  readonly stateVariations: readonly string[];
}

const METADATA: Readonly<Record<string, ProductMetadata>> = Object.freeze({
${metadataEntries}
});

const ALL_PRODUCTS: readonly Product[] = Object.freeze(
  Object.values(Product) as Product[],
);

function lc(s: string): string {
  return s.toLowerCase();
}

/** Catalog API for \`Product\`. All methods return frozen, sorted views. */
export const Products = Object.freeze({
  /** Every product slug. Sorted alphabetically. */
  values(): readonly Product[] {
    return ALL_PRODUCTS;
  },
  /** \`[Product, ProductMetadata]\` pairs in catalog order. */
  entries(): ReadonlyArray<readonly [Product, ProductMetadata]> {
    return ALL_PRODUCTS.map((p) => [p, METADATA[p]!] as const);
  },
  /** Products filed by a given carrier slug. Case-insensitive match. */
  byCarrier(carrier: string): readonly Product[] {
    const target = lc(carrier);
    return ALL_PRODUCTS.filter((p) => METADATA[p]!.carrier === target);
  },
  /**
   * Substring search across slug, display name, and state-specific names.
   * Returns matches sorted by relevance (prefix matches first, then
   * substring matches).
   */
  search(query: string): readonly Product[] {
    const q = lc(query.trim());
    if (q === '') return [];
    const prefix: Product[] = [];
    const substring: Product[] = [];
    for (const p of ALL_PRODUCTS) {
      const m = METADATA[p]!;
      const variations = m.stateVariations.map(lc).join(' ');
      const hay = (m.slug + ' ' + lc(m.displayName) + ' ' + variations);
      if (
        hay.startsWith(q) ||
        lc(m.displayName).startsWith(q) ||
        m.stateVariations.some((name) => lc(name).startsWith(q))
      ) {
        prefix.push(p);
      } else if (hay.includes(q)) {
        substring.push(p);
      }
    }
    return [...prefix, ...substring];
  },
  /** Metadata lookup; throws on unknown slug (the enum makes that impossible at compile time). */
  metadata(p: Product): ProductMetadata {
    const m = METADATA[p];
    if (!m) throw new Error(\`Products.metadata: unknown product '\${p}'\`);
    return m;
  },
});
`;

  writeFile('products.ts', productsModule);

  const byCarrier = new Map();
  for (const p of products) {
    const entry = byCarrier.get(p.carrierSlug) || {
      slug: p.carrierSlug,
      displayName: p.carrierDisplay,
      products: [],
    };
    entry.products.push(p.slug);
    byCarrier.set(p.carrierSlug, entry);
  }
  const carriers = [...byCarrier.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  const carrierEntries = carriers
    .map((c) => {
      const productExprs = c.products.map((p) => `Product.${pascal(p)}`).join(', ');
      return `  '${c.slug}': { displayName: ${JSON.stringify(c.displayName)}, products: [${productExprs}], states: [] },`;
    })
    .join('\n');
  const carrierSlugs = carriers.map((c) => `'${c.slug}'`).join(', ');

  const carriersModule = `${HEADER(sources)}
import { Product } from './products.js';
import type { State } from './states.js';

/** Public metadata for a single carrier. */
export interface ProductCarrierMetadata {
  readonly displayName: string;
  readonly products: readonly Product[];
  /** ISO 2-letter state codes the carrier is licensed in. */
  readonly states: readonly State[];
}

const CARRIERS: Readonly<Record<string, ProductCarrierMetadata>> = Object.freeze({
${carrierEntries}
});

const ALL_CARRIERS: readonly string[] = Object.freeze([${carrierSlugs}]);

/**
 * Catalog API for carriers. Carrier slugs are stable; display names follow
 * the engine's product catalog.
 *
 * \`states\` is empty today — per-carrier licensure is not currently
 * surfaced in the public reference data. Treat as advisory.
 */
export const ProductCarriers = Object.freeze({
  values(): readonly string[] {
    return ALL_CARRIERS;
  },
  metadata(c: string): ProductCarrierMetadata {
    const m = CARRIERS[c];
    if (!m) throw new Error(\`ProductCarriers.metadata: unknown carrier '\${c}'\`);
    return m;
  },
});
`;
  writeFile('carriers.ts', carriersModule);

  return { products, carriers };
}

function emptyProductsModule() {
  return `
export enum Product {}
export interface ProductMetadata {
  readonly slug: string;
  readonly displayName: string;
  readonly carrier: string;
  readonly productClass: string;
  readonly ages: { readonly min: number; readonly max: number };
  readonly states: readonly string[];
  readonly faceAmount: { readonly min: number; readonly max: number };
  readonly stateVariations: readonly string[];
}
export const Products = Object.freeze({
  values(): readonly Product[] { return []; },
  entries(): ReadonlyArray<readonly [Product, ProductMetadata]> { return []; },
  byCarrier(_carrier: string): readonly Product[] { return []; },
  search(_query: string): readonly Product[] { return []; },
  metadata(p: Product): ProductMetadata {
    throw new Error(\`Products.metadata: unknown product '\${p}'\`);
  },
});
`;
}

function emptyCarriersModule() {
  return `
import type { Product } from './products.js';
import type { State } from './states.js';
export interface ProductCarrierMetadata {
  readonly displayName: string;
  readonly products: readonly Product[];
  readonly states: readonly State[];
}
export const ProductCarriers = Object.freeze({
  values(): readonly string[] { return []; },
  metadata(c: string): ProductCarrierMetadata {
    throw new Error(\`ProductCarriers.metadata: unknown carrier '\${c}'\`);
  },
});
`;
}

// ---------------------------------------------------------------------------
// States — static ISO 3166-2:US (50 states + DC + 5 inhabited territories)
// ---------------------------------------------------------------------------

const STATES = [
  ['Alabama', 'AL', false],
  ['Alaska', 'AK', false],
  ['Arizona', 'AZ', false],
  ['Arkansas', 'AR', false],
  ['California', 'CA', false],
  ['Colorado', 'CO', false],
  ['Connecticut', 'CT', false],
  ['Delaware', 'DE', false],
  ['Florida', 'FL', false],
  ['Georgia', 'GA', false],
  ['Hawaii', 'HI', false],
  ['Idaho', 'ID', false],
  ['Illinois', 'IL', false],
  ['Indiana', 'IN', false],
  ['Iowa', 'IA', false],
  ['Kansas', 'KS', false],
  ['Kentucky', 'KY', false],
  ['Louisiana', 'LA', false],
  ['Maine', 'ME', false],
  ['Maryland', 'MD', false],
  ['Massachusetts', 'MA', false],
  ['Michigan', 'MI', false],
  ['Minnesota', 'MN', false],
  ['Mississippi', 'MS', false],
  ['Missouri', 'MO', false],
  ['Montana', 'MT', false],
  ['Nebraska', 'NE', false],
  ['Nevada', 'NV', false],
  ['New Hampshire', 'NH', false],
  ['New Jersey', 'NJ', false],
  ['New Mexico', 'NM', false],
  ['New York', 'NY', false],
  ['North Carolina', 'NC', false],
  ['North Dakota', 'ND', false],
  ['Ohio', 'OH', false],
  ['Oklahoma', 'OK', false],
  ['Oregon', 'OR', false],
  ['Pennsylvania', 'PA', false],
  ['Rhode Island', 'RI', false],
  ['South Carolina', 'SC', false],
  ['South Dakota', 'SD', false],
  ['Tennessee', 'TN', false],
  ['Texas', 'TX', false],
  ['Utah', 'UT', false],
  ['Vermont', 'VT', false],
  ['Virginia', 'VA', false],
  ['Washington', 'WA', false],
  ['West Virginia', 'WV', false],
  ['Wisconsin', 'WI', false],
  ['Wyoming', 'WY', false],
  ['District of Columbia', 'DC', false],
  ['American Samoa', 'AS', true],
  ['Guam', 'GU', true],
  ['Northern Mariana Islands', 'MP', true],
  ['Puerto Rico', 'PR', true],
  ['United States Virgin Islands', 'VI', true],
];

function genStates() {
  const sources = ['ISO 3166-2:US (50 states + DC + 5 inhabited territories)'];
  const states = [...STATES].sort(([a], [b]) => a.localeCompare(b));
  const members = states.map(([name, abbr]) => `  ${pascal(name)} = '${abbr}',`).join('\n');
  const meta = states.map(
    ([name, abbr, isTerr]) =>
      `  '${abbr}': { abbreviation: '${abbr}', name: ${JSON.stringify(name)}, isTerritory: ${isTerr} },`,
  ).join('\n');
  const byName = states.map(([name, abbr]) => `  ${JSON.stringify(name.toLowerCase())}: '${abbr}',`).join('\n');

  const module = `${HEADER(sources)}
/**
 * ISO 3166-2:US administrative subdivisions. Includes the 50 states, DC,
 * and the five inhabited US territories. Order is alphabetical by name.
 */
export enum State {
${members}
}

export interface StateMetadata {
  readonly abbreviation: string;
  readonly name: string;
  readonly isTerritory: boolean;
}

const METADATA: Readonly<Record<string, StateMetadata>> = Object.freeze({
${meta}
});

const BY_NAME: Readonly<Record<string, string>> = Object.freeze({
${byName}
});

const ALL_STATES: readonly State[] = Object.freeze(Object.values(State) as State[]);

export const States = Object.freeze({
  values(): readonly State[] {
    return ALL_STATES;
  },
  entries(): ReadonlyArray<readonly [State, StateMetadata]> {
    return ALL_STATES.map((s) => [s, METADATA[s]!] as const);
  },
  metadata(s: State): StateMetadata {
    const m = METADATA[s];
    if (!m) throw new Error(\`States.metadata: unknown state '\${s}'\`);
    return m;
  },
  /**
   * Look up a state by its ISO abbreviation (case-insensitive) or by its
   * full English name (case-insensitive). Returns \`undefined\` for
   * unknown input.
   */
  byAbbreviation(abbr: string): State | undefined {
    const upper = abbr.toUpperCase();
    if (upper in METADATA) return upper as State;
    const fromName = BY_NAME[abbr.toLowerCase()];
    return fromName ? (fromName as State) : undefined;
  },
});
`;
  writeFile('states.ts', module);
}

// ---------------------------------------------------------------------------
// Conditions & MedicationUses
// ---------------------------------------------------------------------------

function genConditionsAndMedicationUses() {
  const medPath = join(INSURANCE_REPO, 'v2_medications.json');
  const meds = tryReadJson(medPath);
  const sources = [
    'insurance/v2_conditions.json',
    'insurance/v2_medications.json',
  ];

  gaps.push(
    'ConditionCategories: source data (v2_conditions.json) does not expose taxonomic categories. Emitting empty catalog.',
  );
  const condCatModule = `${HEADER(sources)}
/**
 * Categories partition the canonical condition list into clinically
 * related groups. The engine's reference data does not currently expose
 * a stable category taxonomy; this catalog is intentionally empty until
 * the upstream publishes one. The shape is fixed so consumers can code
 * against it today.
 */
export interface ConditionCategoryMetadata {
  readonly displayName: string;
  /** Canonical condition names (uppercase, engine wire format). */
  readonly conditions: readonly string[];
}

const CATEGORIES: Readonly<Record<string, ConditionCategoryMetadata>> = Object.freeze({});

const ALL_CATEGORIES: readonly string[] = Object.freeze([]);

export const ConditionCategories = Object.freeze({
  values(): readonly string[] {
    return ALL_CATEGORIES;
  },
  metadata(c: string): ConditionCategoryMetadata {
    const m = CATEGORIES[c];
    if (!m) throw new Error(\`ConditionCategories.metadata: unknown category '\${c}'\`);
    return m;
  },
});
`;
  writeFile('conditions.ts', condCatModule);

  /** @type {Map<string, Set<string>>} */
  const useToMeds = new Map();
  if (Array.isArray(meds)) {
    for (const m of meds) {
      if (!m || typeof m !== 'object') continue;
      const name = String(m.name || '');
      const uses = Array.isArray(m.uses) ? m.uses : [];
      for (const u of uses) {
        if (!u || typeof u !== 'object') continue;
        const cond = String(u.condition || '');
        if (!cond || !name) continue;
        let set = useToMeds.get(cond);
        if (!set) {
          set = new Set();
          useToMeds.set(cond, set);
        }
        set.add(name);
      }
    }
  } else {
    gaps.push('MedicationUses: v2_medications.json missing or malformed.');
  }

  const useNames = [...useToMeds.keys()].sort();
  const useEntries = useNames
    .map((u) => {
      const m = [...useToMeds.get(u)].sort();
      return `  ${JSON.stringify(u)}: { displayName: ${JSON.stringify(u)}, medications: ${JSON.stringify(m)} },`;
    })
    .join('\n');

  const useModule = `${HEADER(sources)}
/**
 * Medication uses (indications). A "use" is a canonical condition name
 * (engine wire format) that at least one medication treats. The
 * \`medications\` array lists every medication recorded as treating
 * that use.
 *
 * Catalog size is large (~3000 uses; ~6000 medications); only the names
 * you import are retained by tree-shakers.
 */
export interface MedicationUseMetadata {
  readonly displayName: string;
  readonly medications: readonly string[];
}

const USES: Readonly<Record<string, MedicationUseMetadata>> = Object.freeze({
${useEntries}
});

const ALL_USES: readonly string[] = Object.freeze(Object.keys(USES).sort());

export const MedicationUses = Object.freeze({
  values(): readonly string[] {
    return ALL_USES;
  },
  metadata(u: string): MedicationUseMetadata {
    const m = USES[u];
    if (!m) throw new Error(\`MedicationUses.metadata: unknown use '\${u}'\`);
    return m;
  },
});
`;
  writeFile('medications.ts', useModule);
}

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

function genScopes() {
  const protoPath = join(PLATFORM_REPO, 'shared', 'schemas', 'api', 'isa', 'v1', 'common.proto');
  const text = tryReadText(protoPath);
  const sources = ['isa-platform/shared/schemas/api/isa/v1/common.proto'];

  /** @type {{ enumName: string, wire: string, doc: string }[]} */
  const scopes = [];
  if (text) {
    const block = text.match(/enum Scope \{([\s\S]*?)\}\s*$/m);
    if (block) {
      const body = block[1];
      const lines = body.split('\n');
      let pendingComment = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) {
          pendingComment += ' ' + trimmed.replace(/^\/\/\s?/, '');
          continue;
        }
        const m = trimmed.match(/^(SCOPE_[A-Z0-9_]+)\s*=\s*\d+;/);
        if (m) {
          const symbol = m[1];
          if (symbol === 'SCOPE_UNSPECIFIED') {
            pendingComment = '';
            continue;
          }
          const wireMatch = pendingComment.match(/`([^`]+)`/);
          if (!wireMatch) {
            pendingComment = '';
            continue;
          }
          const wire = wireMatch[1];
          const doc = pendingComment.replace(/`[^`]+`\s*—?\s*/, '').trim();
          const enumName = wire
            .split(/[:\-]/)
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
            .join('');
          scopes.push({ enumName, wire, doc });
          pendingComment = '';
        } else if (trimmed === '') {
          pendingComment = '';
        }
      }
    }
  }

  if (scopes.length === 0) {
    gaps.push('Scope: failed to parse common.proto Scope enum — emitting empty catalog.');
  }

  scopes.sort((a, b) => a.wire.localeCompare(b.wire));

  const members = scopes.map((s) => `  /** ${s.doc} */\n  ${s.enumName} = '${s.wire}',`).join('\n');
  const descEntries = scopes.map((s) => `  '${s.wire}': ${JSON.stringify(s.doc)},`).join('\n');

  const module = `${HEADER(sources)}
/**
 * Bearer-token scopes recognized across the ISA platform. Mirrors the
 * \`api.isa.v1.Scope\` proto enum's wire-form values; new scopes ship
 * here when added upstream.
 */
export enum Scope {
${members}
}

export const ScopeDescriptions: Readonly<Record<Scope, string>> = Object.freeze({
${descEntries}
}) as Readonly<Record<Scope, string>>;
`;
  writeFile('scopes.ts', module);
}

// ---------------------------------------------------------------------------
// SignEvents
// ---------------------------------------------------------------------------

function genSignEvents() {
  const path = join(PLATFORM_REPO, 'shared', 'go', 'events', 'registry.go');
  const text = tryReadText(path);
  const sources = ['isa-platform/shared/go/events/registry.go'];

  /** @type {{ enumName: string, wire: string }[]} */
  const events = [];
  if (text) {
    const re = /EventType[A-Za-z0-9]+\s+EventType\s*=\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const wire = m[1];
      if (!/^(document|signer)\./.test(wire)) continue;
      const enumName = wire
        .split('.')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join('');
      events.push({ enumName, wire });
    }
  }

  if (events.length === 0) {
    gaps.push('SignEvent: no rapidsign-domain events parsed from registry.go.');
  }

  events.sort((a, b) => a.wire.localeCompare(b.wire));
  const members = events.map((e) => `  ${e.enumName} = '${e.wire}',`).join('\n');
  const labels = events.map((e) => `  '${e.wire}': ${JSON.stringify(eventLabel(e.wire))},`).join('\n');

  const module = `${HEADER(sources)}
/**
 * RapidSign webhook event types. The wire string is the EventBridge
 * \`detail-type\` value the platform emits.
 */
export enum SignEvent {
${members}
}

export const SignEventLabels: Readonly<Record<SignEvent, string>> = Object.freeze({
${labels}
}) as Readonly<Record<SignEvent, string>>;
`;
  writeFile('signEvents.ts', module);
}

function eventLabel(wire) {
  return wire
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

// ---------------------------------------------------------------------------
// ErrorCode / ErrorAdviceCodes / ErrorDocUrls
// ---------------------------------------------------------------------------

function genErrors() {
  const protoPath = join(PLATFORM_REPO, 'shared', 'schemas', 'api', 'isa', 'v1', 'common.proto');
  const text = tryReadText(protoPath);
  const sources = ['isa-platform/shared/schemas/api/isa/v1/common.proto'];

  /** @type {{ enumName: string, wire: string, doc: string }[]} */
  const codes = [];
  if (text) {
    const block = text.match(/enum ErrorCode \{([\s\S]*?)\}/m);
    if (block) {
      const lines = block[1].split('\n');
      let pendingComment = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) {
          pendingComment += ' ' + trimmed.replace(/^\/\/\s?/, '');
          continue;
        }
        const m = trimmed.match(/^ERROR_CODE_([A-Z0-9_]+)\s*=\s*\d+;/);
        if (m) {
          const symbol = m[1];
          if (symbol === 'UNSPECIFIED') {
            pendingComment = '';
            continue;
          }
          const wire = symbol.toLowerCase();
          const enumName = symbol
            .split('_')
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
            .join('');
          codes.push({ enumName, wire, doc: pendingComment.trim() });
          pendingComment = '';
        } else if (trimmed === '') {
          pendingComment = '';
        }
      }
    }
  }

  if (codes.length === 0) {
    gaps.push('ErrorCode: failed to parse common.proto ErrorCode enum — emitting empty catalog.');
  }

  const compatCodes = [
    {
      enumName: 'DeadlineExceeded',
      wire: 'deadline_exceeded',
      doc: 'Operation exceeded its deadline before completing.',
    },
    {
      enumName: 'RateLimited',
      wire: 'rate_limited',
      doc: 'Legacy RapidSign rate limit code. Retry after the server-provided delay.',
    },
    {
      enumName: 'Unknown',
      wire: 'unknown',
      doc: 'Unrecognized error code preserved for forward compatibility.',
    },
  ];
  const knownCodes = new Set(codes.map((c) => c.wire));
  for (const code of compatCodes) {
    if (!knownCodes.has(code.wire)) codes.push(code);
  }

  codes.sort((a, b) => a.wire.localeCompare(b.wire));

  // Advice codes: stable machine-readable next-action identifiers per code.
  // These mirror the `advice_code` examples in SDK_DESIGN.md.
  const ADVICE_MAP = new Map([
    ['validation_error', 'fix_request_body'],
    ['idempotency_conflict', 'retry_with_new_key'],
    ['rate_limit_exceeded', 'wait_and_retry'],
    ['token_expired', 'refresh_session'],
    ['invalid_token', 'reissue_session'],
    ['license_locked', 'contact_support'],
    ['forbidden', 'check_scopes'],
    ['not_found', 'verify_resource_id'],
    ['method_not_allowed', 'check_http_method'],
    ['conflict', 'reconcile_state'],
    ['unauthorized', 'authenticate_caller'],
    ['internal_error', 'retry_or_contact_support'],
    ['bad_gateway', 'retry_with_backoff'],
    ['deadline_exceeded', 'retry_with_backoff'],
    ['gateway_timeout', 'retry_with_backoff'],
    ['rate_limited', 'wait_and_retry'],
    ['service_unavailable', 'retry_with_backoff'],
    ['not_implemented', 'check_feature_availability'],
    ['unknown', 'see_docs'],
  ]);

  const members = codes.map((c) => `  /** ${c.doc} */\n  ${c.enumName} = '${c.wire}',`).join('\n');
  const adviceEntries = codes
    .map((c) => `  '${c.wire}': '${ADVICE_MAP.get(c.wire) || 'see_docs'}',`)
    .join('\n');
  const docEntries = codes
    .map((c) => `  '${c.wire}': 'https://docs.isaapi.com/errors/${c.wire}',`)
    .join('\n');

  const module = `${HEADER(sources)}
/**
 * Stable wire-form error codes. Mirrors \`api.isa.v1.ErrorCode\`. Consumers
 * MUST switch on these values rather than HTTP status or message text.
 *
 * This enum extends the legacy \`ErrorCode\` type alias exported from
 * \`./rapidsign/errors\` — the string values match exactly, so callers
 * passing a wire-form string to either surface compile cleanly.
 */
export enum ErrorCode {
${members}
}

/**
 * Machine-readable next-action identifiers. Keys are wire-form error codes;
 * values are stable identifiers a programmatic consumer can switch on to
 * choose a retry / refresh / surface-to-user strategy.
 */
export const ErrorAdviceCodes: Readonly<Record<ErrorCode, string>> = Object.freeze({
${adviceEntries}
}) as Readonly<Record<ErrorCode, string>>;

/** Doc URL per error code. Every value resolves to a live remediation page. */
export const ErrorDocUrls: Readonly<Record<ErrorCode, string>> = Object.freeze({
${docEntries}
}) as Readonly<Record<ErrorCode, string>>;
`;
  writeFile('errors.ts', module);
}

// ---------------------------------------------------------------------------
// Products-by-type (nested catalog with typed Product objects)
// ---------------------------------------------------------------------------

function genProductsByType() {
  const path = join(INSURANCE_REPO, 'v2_products.json');
  const raw = tryReadJson(path);
  const sources = ['insurance/v2_products.json'];
  if (!raw) {
    gaps.push('ProductsByType: v2_products.json not found — emitting empty nested catalog.');
    writeFile('productsByType.ts', HEADER(sources) + emptyProductsByTypeModule());
    return;
  }
  const TYPE_MAP = {
    fex: { tsKey: 'FinalExpense', nsKey: 'Fex' },
    medsup: { tsKey: 'MedicareSupplement', nsKey: 'Medsup' },
    preneed: { tsKey: 'Preneed', nsKey: 'Preneed' },
    term: { tsKey: 'Term', nsKey: 'Term' },
  };

  function carrierFrom(displayName) {
    const words = displayName.split(/\s+/);
    if (words.length <= 1) return displayName;
    return words[0].length >= 3 ? words[0] : `${words[0]} ${words[1]}`;
  }

  const namespaces = { Fex: [], Medsup: [], Preneed: [], Term: [] };
  const unknownTypes = new Set();
  const seenByNs = { Fex: new Set(), Medsup: new Set(), Preneed: new Set(), Term: new Set() };
  const seenWireTokens = new Set();
  for (const [wireType, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const tm = TYPE_MAP[wireType];
    if (!tm) {
      unknownTypes.add(wireType);
      continue;
    }
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;
      const displayName = String(entry.name || '');
      const identifier = String(entry.identifier || '');
      if (!displayName || !identifier) continue;
      const enumKey = pascal(displayName);
      if (seenByNs[tm.nsKey].has(enumKey)) {
        throw new Error(
          `ProductsByType: duplicate enumKey '${enumKey}' in namespace '${tm.nsKey}'`,
        );
      }
      if (seenWireTokens.has(identifier)) {
        throw new Error(`ProductsByType: duplicate wireToken '${identifier}'`);
      }
      seenByNs[tm.nsKey].add(enumKey);
      seenWireTokens.add(identifier);
      namespaces[tm.nsKey].push({
        enumKey,
        wireToken: identifier,
        displayName,
        ctorName: tm.tsKey,
        carrier: carrierFrom(displayName),
      });
    }
    namespaces[tm.nsKey].sort((a, b) => a.enumKey.localeCompare(b.enumKey));
  }
  if (unknownTypes.size > 0) {
    gaps.push(
      `ProductsByType: unsupported product classes found (${[...unknownTypes].sort().join(', ')}). Update TYPE_MAP.`,
    );
  }

  function bagBody(items, ctorName) {
    return items.map((p) =>
      `  ${p.enumKey}: Object.freeze({ wireToken: ${JSON.stringify(p.wireToken)}, displayName: ${JSON.stringify(p.displayName)}, productType: ProductType.${ctorName}, carrier: ${JSON.stringify(p.carrier)} }) as Product,`,
    ).join('\n');
  }

  const module = `${HEADER(sources)}
/** Coarse product family. The \`wireToken\` is the server's class identifier. */
export const ProductType = {
  FinalExpense:       { wireToken: 'fex',     displayName: 'Final Expense',       namespaceKey: 'Fex'     },
  MedicareSupplement: { wireToken: 'medsup',  displayName: 'Medicare Supplement', namespaceKey: 'Medsup'  },
  Preneed:            { wireToken: 'preneed', displayName: 'Preneed',             namespaceKey: 'Preneed' },
  Term:               { wireToken: 'term',    displayName: 'Term',                namespaceKey: 'Term'    },
} as const;

export type ProductTypeValue = (typeof ProductType)[keyof typeof ProductType];

/** A typed product. Stable across SDK releases inside one wire major. */
export interface Product {
  readonly wireToken: string;
  readonly displayName: string;
  readonly productType: ProductTypeValue;
  /** Carrier brand extracted from the display name (first 1–2 words). */
  readonly carrier: string;
}

const FEX_PRODUCTS = {
${bagBody(namespaces.Fex, 'FinalExpense')}
} as const;

const MEDSUP_PRODUCTS = {
${bagBody(namespaces.Medsup, 'MedicareSupplement')}
} as const;

const PRENEED_PRODUCTS = {
${bagBody(namespaces.Preneed, 'Preneed')}
} as const;

const TERM_PRODUCTS = {
${bagBody(namespaces.Term, 'Term')}
} as const;

type ProductBag = Readonly<Record<string, Product>>;

const ALL_PRODUCTS: readonly Product[] = Object.freeze([
  ...Object.values(FEX_PRODUCTS),
  ...Object.values(MEDSUP_PRODUCTS),
  ...Object.values(PRENEED_PRODUCTS),
  ...Object.values(TERM_PRODUCTS),
]);

const BY_WIRE_TOKEN: Readonly<Record<string, Product>> = Object.freeze(
  Object.fromEntries(ALL_PRODUCTS.map((p) => [p.wireToken, p])),
);

export const Products = Object.freeze({
  Fex: FEX_PRODUCTS as ProductBag,
  Medsup: MEDSUP_PRODUCTS as ProductBag,
  Preneed: PRENEED_PRODUCTS as ProductBag,
  Term: TERM_PRODUCTS as ProductBag,
  all(): readonly Product[] { return ALL_PRODUCTS; },
  byWireToken(token: string): Product | undefined { return BY_WIRE_TOKEN[token]; },
  byLegacy(productType: ProductTypeValue, displayName: string): Product | undefined {
    const ns = (Products as unknown as Record<string, ProductBag>)[productType.namespaceKey];
    if (!ns) return undefined;
    const needle = displayName.toLowerCase();
    for (const p of Object.values(ns)) {
      if (p.displayName.toLowerCase() === needle) return p;
    }
    return undefined;
  },
}) as Readonly<{
  Fex: ProductBag;
  Medsup: ProductBag;
  Preneed: ProductBag;
  Term: ProductBag;
  all: () => readonly Product[];
  byWireToken: (token: string) => Product | undefined;
  byLegacy: (productType: ProductTypeValue, displayName: string) => Product | undefined;
}>;
`;
  writeFile('productsByType.ts', module);
}

function emptyProductsByTypeModule() {
  return `
export const ProductType = {
  FinalExpense:       { wireToken: 'fex',     displayName: 'Final Expense',       namespaceKey: 'Fex'     },
  MedicareSupplement: { wireToken: 'medsup',  displayName: 'Medicare Supplement', namespaceKey: 'Medsup'  },
  Preneed:            { wireToken: 'preneed', displayName: 'Preneed',             namespaceKey: 'Preneed' },
  Term:               { wireToken: 'term',    displayName: 'Term',                namespaceKey: 'Term'    },
} as const;
export type ProductTypeValue = (typeof ProductType)[keyof typeof ProductType];
export interface Product { readonly wireToken: string; readonly displayName: string; readonly productType: ProductTypeValue; readonly carrier: string; }
type ProductBag = Readonly<Record<string, Product>>;
const EMPTY: ProductBag = Object.freeze({});
export const Products = Object.freeze({
  Fex: EMPTY, Medsup: EMPTY, Preneed: EMPTY, Term: EMPTY,
  all(): readonly Product[] { return []; },
  byWireToken(_t: string): Product | undefined { return undefined; },
  byLegacy(_pt: ProductTypeValue, _n: string): Product | undefined { return undefined; },
});
`;
}

// ---------------------------------------------------------------------------
// Index barrel
// ---------------------------------------------------------------------------

function genIndex() {
  const module = `${HEADER(['(barrel re-export of every catalog module in this directory)'])}
export { Product, Products, type ProductMetadata } from './products.js';
export {
  ProductType,
  Products as ProductsByType,
  type Product as TypedProduct,
  type ProductTypeValue,
} from './productsByType.js';
export { State, States, type StateMetadata } from './states.js';
export { ProductCarriers, type ProductCarrierMetadata } from './carriers.js';
export { ConditionCategories, type ConditionCategoryMetadata } from './conditions.js';
export { MedicationUses, type MedicationUseMetadata } from './medications.js';
export { Scope, ScopeDescriptions } from './scopes.js';
export { SignEvent, SignEventLabels } from './signEvents.js';
export { ErrorCode, ErrorAdviceCodes, ErrorDocUrls } from './errors.js';
`;
  writeFile('index.ts', module);
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

ensureDir(CATALOG_DIR);
genStates();
genProducts();
genProductsByType();
genConditionsAndMedicationUses();
genScopes();
genSignEvents();
genErrors();
genIndex();

if (gaps.length > 0) {
  process.stderr.write('\ngen-catalog: data-source gaps:\n');
  for (const g of gaps) process.stderr.write(`  - ${g}\n`);
}
process.stderr.write('\ngen-catalog: done\n');
