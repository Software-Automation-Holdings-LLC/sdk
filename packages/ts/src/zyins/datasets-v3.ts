/**
 * `GET /v3/datasets` — the typed, inline-row reference catalog.
 *
 * Wire shape (locked):
 *   - Every dataset row is self-contained — `treated_with[]` (condition
 *     rows) and `used_for[]` (medication rows) carry the relationships
 *     inline with `prescription_count` integers.
 *   - NO response-root maps. `medications_by_condition`, `frequency_graphs`,
 *     `use_map`, `med_map` are REMOVED; the row IS the source of truth.
 *   - `spelling_corrections` is a first-class dataset, mintable into a
 *     typo map via {@link buildTypoMap}.
 *
 * This module owns ONLY the wire shape + the parser. Consumer-side index
 * construction (`ReferenceIndex`) lives in `./reference/referenceIndex.ts`.
 */

import type { OperationContext } from './client';
import { buildLicenseHMACHeaders } from '../core';
import { systemClock } from '../core';
import { fromHttpResponse } from './errors';

/** Closed enum of dataset categories the server returns. */
export type DatasetCategory = 'medications' | 'conditions' | 'products' | 'spelling_corrections' | 'nicotine_options';

/** Base reference entity: every row carries at least `id` + `name`. */
export interface ReferenceEntity {
    /** Opaque entity identifier. Today: kind-prefixed ULID (`cond_`, `med_`, ...). */
    readonly id: string;
    /** Display name from the catalog. */
    readonly name: string;
}

/** Inline `treated_with[]` entry on a condition row. */
export interface ConditionTreatedWith {
    /** Medication id. */
    readonly id: string;
    /** Medication display name. */
    readonly name: string;
    /**
     * Number of observed prescriptions of this medication for this
     * condition. Source of truth for frequency-based sort.
     */
    readonly prescription_count: number;
}

/** A condition row — carries its medications inline. */
export interface ConditionEntity extends ReferenceEntity {
    /** Pre-sorted by `prescription_count` desc; ties alphabetical asc. */
    readonly treated_with: readonly ConditionTreatedWith[];
}

/** Inline `used_for[]` entry on a medication row. */
export interface MedicationUsedFor {
    /** Condition id. */
    readonly id: string;
    /** Condition display name. */
    readonly name: string;
    /**
     * Number of observed prescriptions of this medication for this
     * condition. Source of truth for frequency-based sort.
     */
    readonly prescription_count: number;
}

/** A medication row — carries its conditions inline. */
export interface MedicationEntity extends ReferenceEntity {
    /** Pre-sorted by `prescription_count` desc; ties alphabetical asc. */
    readonly used_for: readonly MedicationUsedFor[];
}

/** A nicotine-option row. */
export interface NicotineOptionEntity extends ReferenceEntity {
    /** Coarse classification of the consumption form. */
    readonly type: 'smoked' | 'smokeless' | 'vapor' | 'other';
}

/** A typo correction row. */
export interface SpellingCorrectionEntity extends ReferenceEntity {
    /** Pre-normalized typo (uppercase). */
    readonly from: string;
    /** Pre-normalized correction (uppercase). */
    readonly to: string;
}

/**
 * Per-dataset version + row count + items. `items` is empty when the
 * caller asks for `fields: 'meta'` — `itemCount` is still populated.
 */
export interface DatasetEntry<T extends ReferenceEntity = ReferenceEntity> {
    /** Opaque per-dataset version token. Bumps when the dataset changes. */
    readonly version: string;
    /** Number of rows. Present in both `full` and `meta` modes. */
    readonly itemCount: number;
    /** The rows. Empty in `meta` mode. */
    readonly items: readonly T[];
}

/**
 * The v3 datasets bundle — inline-row shape.
 *
 * Every relationship is on the row itself; the SDK never re-derives keys
 * or rebuilds reverse maps from response-root joins. Consumers reading
 * the raw JSON understand every row standalone.
 */
export interface DatasetBundleV3 {
    /** Response ETag for conditional revalidation. */
    readonly etag: string | undefined;
    /** Opaque catalog-wide version token. */
    readonly version: string;
    /** All known medications with inline `used_for[]`. */
    readonly medications: readonly MedicationEntity[];
    /** All known conditions with inline `treated_with[]`. */
    readonly conditions: readonly ConditionEntity[];
    /** Products as typed entities. */
    readonly products: readonly ReferenceEntity[];
    /** Nicotine options with `type` classification. */
    readonly nicotineOptions: readonly NicotineOptionEntity[];
    /** Spelling corrections (typo → correction). */
    readonly spellingCorrections: readonly SpellingCorrectionEntity[];
    /**
     * Per-category dataset entries (version, item_count, items). Useful
     * for staleness checks and for `fields: 'meta'` mode.
     */
    readonly datasets: Readonly<Record<DatasetCategory, DatasetEntry | undefined>>;
    /**
     * Product slices keyed by family slug — the products available within
     * each marketing family. Empty when the server omits the slice.
     * Consumers (e.g. a product-list UI) read this directly rather than
     * re-deriving family membership from flat product rows.
     */
    readonly productsByFamily: Readonly<Record<string, readonly ReferenceEntity[]>>;
    /**
     * Discontinued products keyed by product slug → the unix epoch second
     * at which the product was discontinued. Empty when none are
     * discontinued or the server omits the slice.
     */
    readonly discontinuedProducts: Readonly<Record<string, number>>;
    /**
     * State derivative slugs — states whose product availability derives
     * from another state's ruleset. Empty when the server omits the slice.
     */
    readonly stateDerivatives: readonly string[];
}

/** Options accepted by `getDatasetsV3`. */
export interface DatasetsV3GetOptions {
    /** Narrow the response to specific categories. Omit for all. */
    readonly include?: readonly DatasetCategory[];
    /** `'meta'` skips row payloads; `'full'` (default) returns everything. */
    readonly fields?: 'full' | 'meta';
    /** Conditional revalidation; passes through as `If-None-Match`. */
    readonly ifNoneMatch?: string;
}

/** Result of a 304-bearing `getDatasetsV3` call. */
export interface DatasetsV3NotModified {
    readonly notModified: true;
    readonly etag: string | undefined;
}

const DATASETS_V3_PATH = '/v3/datasets';

/**
 * Discriminator helper. Lets a caller switch on the result without
 * peeking at `notModified`.
 *
 * @example
 * ```ts
 * const result = await isa.zyins.datasets.getV3();
 * if (isNotModified(result)) useCachedBundle();
 * else useFreshBundle(result);
 * ```
 */
export function isNotModified(result: DatasetBundleV3 | DatasetsV3NotModified): result is DatasetsV3NotModified {
    return (result as DatasetsV3NotModified).notModified === true;
}

/**
 * Build the canonical typo map from a bundle's `spellingCorrections`.
 *
 * Keys and values are both UPPERCASE; consumers MUST uppercase their
 * inputs before lookup. Conventionally fed into
 * {@link DefaultAutocorrector}.
 */
export function buildTypoMap(bundle: Pick<DatasetBundleV3, 'spellingCorrections'>): ReadonlyMap<string, string> {
    const map = new Map<string, string>();
    for (const row of bundle.spellingCorrections) {
        if (!row.from || !row.to) continue;
        map.set(row.from.toUpperCase(), row.to.toUpperCase());
    }
    return map;
}

/**
 * Aggregate per-id prescription frequency from inline rows.
 *
 * For each condition: sum of `treated_with[].prescription_count`.
 * For each medication: sum of `used_for[].prescription_count`.
 *
 * Consumers feed this into {@link AutocompleteAlgorithm.rank} as the
 * `frequencies` map.
 */
export function buildFrequencyMap(bundle: Pick<DatasetBundleV3, 'conditions' | 'medications'>): ReadonlyMap<string, number> {
    const map = new Map<string, number>();
    for (const cond of bundle.conditions) {
        let total = 0;
        for (const row of cond.treated_with) total += row.prescription_count;
        map.set(cond.id, total);
    }
    for (const med of bundle.medications) {
        let total = 0;
        for (const row of med.used_for) total += row.prescription_count;
        map.set(med.id, total);
    }
    return map;
}

export async function getDatasetsV3(options: DatasetsV3GetOptions | undefined, ctx: OperationContext): Promise<DatasetBundleV3 | DatasetsV3NotModified> {
    const queryString = buildQueryString(options);
    const pathWithQuery = queryString ? `${DATASETS_V3_PATH}?${queryString}` : DATASETS_V3_PATH;
    const headers: Record<string, string> = {
        ...(await buildLicenseHMACHeaders(ctx.auth.licenseKey, ctx.auth.orderId, ctx.auth.email, 'GET', pathWithQuery, '', ctx.auth.deviceId, ctx.clock ?? systemClock)),
    };
    if (options?.ifNoneMatch) {
        headers['If-None-Match'] = options.ifNoneMatch;
    }

    const response = await ctx.transport({
        url: `${ctx.baseUrl}${pathWithQuery}`,
        method: 'GET',
        headers,
        body: '',
    });

    if (response.status === 304) {
        return {
            notModified: true,
            etag: readEtag(response.headers),
        };
    }
    if (response.status < 200 || response.status >= 300) {
        throw fromHttpResponse(response.status, response.body);
    }
    return parseEnvelope(response.body, readEtag(response.headers));
}

function buildQueryString(options: DatasetsV3GetOptions | undefined): string {
    if (!options) return '';
    const parts: string[] = [];
    if (options.include !== undefined) {
        parts.push(`include=${options.include.map(encodeDatasetCategory).join(',')}`);
    }
    if (options.fields !== undefined) {
        parts.push(`fields=${options.fields}`);
    }
    return parts.join('&');
}

function encodeDatasetCategory(category: DatasetCategory): string {
    if (category === 'spelling_corrections') return 'corrections';
    return category;
}

function readEtag(headers: Readonly<Record<string, string>>): string | undefined {
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === 'etag') return value;
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Parsing — defensive but never lossy.
// ---------------------------------------------------------------------------
const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

function parseEnvelope(body: string, etag: string | undefined): DatasetBundleV3 {
    let parsed: unknown;
    try {
        parsed = JSON.parse(body);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Invalid JSON response from ${DATASETS_V3_PATH}: ${message}`);
    }
    const root = isRecord(parsed) ? parsed : {};
    const data = isRecord(root['data']) ? (root['data'] as Record<string, unknown>) : {};
    return parseData(data, etag);
}

function parseData(data: Record<string, unknown>, etag: string | undefined): DatasetBundleV3 {
    const datasetsField = isRecord(data['datasets']) ? (data['datasets'] as Record<string, unknown>) : {};

    const conditionsEntry = parseConditionsEntry(datasetsField['conditions']);
    const medicationsEntry = parseMedicationsEntry(datasetsField['medications']);
    const productsEntry = parseGenericEntry(datasetsField['products']);
    const spellingEntry = parseSpellingCorrectionsEntry(datasetsField['spelling_corrections'] ?? datasetsField['corrections']);
    const nicotineEntry = parseNicotineOptionsEntry(datasetsField['nicotine_options']);

    const datasets: Record<DatasetCategory, DatasetEntry | undefined> = {
        conditions: conditionsEntry,
        medications: medicationsEntry,
        products: productsEntry,
        spelling_corrections: spellingEntry,
        nicotine_options: nicotineEntry,
    };

    return {
        etag,
        version: typeof data['catalog_version'] === 'string' ? (data['catalog_version'] as string) : typeof data['version'] === 'string' ? (data['version'] as string) : '',
        conditions: (conditionsEntry?.items as readonly ConditionEntity[] | undefined) ?? [],
        medications: (medicationsEntry?.items as readonly MedicationEntity[] | undefined) ?? [],
        products: productsEntry?.items ?? [],
        spellingCorrections: (spellingEntry?.items as readonly SpellingCorrectionEntity[] | undefined) ?? [],
        nicotineOptions: (nicotineEntry?.items as readonly NicotineOptionEntity[] | undefined) ?? [],
        datasets,
        productsByFamily: parseProductsByFamily(data['products_by_family']),
        discontinuedProducts: parseDiscontinuedProducts(data['discontinued_products']),
        stateDerivatives: parseStateDerivatives(data['state_derivatives']),
    };
}

function parseProductsByFamily(raw: unknown): Readonly<Record<string, readonly ReferenceEntity[]>> {
    if (!isRecord(raw)) return {};
    const out: Record<string, readonly ReferenceEntity[]> = {};
    for (const [family, value] of Object.entries(raw)) {
        if (!Array.isArray(value)) continue;
        const entities: ReferenceEntity[] = [];
        for (const it of value) {
            if (!isRecord(it)) continue;
            const id = it['id'];
            const name = it['name'];
            // A row is valid iff it carries a non-empty `id` — the opaque
            // contract key. `name` is display enrichment the server may
            // legitimately leave blank or absent, so a missing/non-string name
            // defaults to '' and keeps the row. Matches the Go/Python/PHP/C#
            // mirrors exactly; only a row with no id is dropped.
            if (typeof id === 'string' && id !== '') {
                entities.push({ id, name: typeof name === 'string' ? name : '' });
            }
        }
        out[family] = entities;
    }
    return out;
}

function parseDiscontinuedProducts(raw: unknown): Readonly<Record<string, number>> {
    if (!isRecord(raw)) return {};
    const out: Record<string, number> = {};
    for (const [slug, value] of Object.entries(raw)) {
        // Epochs are unix seconds — require an integer-valued number so a
        // fractional epoch is skipped rather than kept. Number.isInteger
        // accepts integer-valued floats (1700000000.0) and rejects genuine
        // fractionals, mirroring the Go/C#/Python/PHP epoch parsers.
        //
        // Out-of-range guard: C#/Go/Python/PHP reject epochs that overflow
        // int64; the JS analog is the safe-integer range — beyond
        // ±Number.MAX_SAFE_INTEGER an integer can no longer be represented
        // faithfully, so the value would be a silently-wrong epoch. Reject it
        // (skip the entry) rather than keep a wrapped/imprecise value.
        if (
            typeof value === 'number' &&
            Number.isInteger(value) &&
            value >= Number.MIN_SAFE_INTEGER &&
            value <= Number.MAX_SAFE_INTEGER
        ) {
            out[slug] = value;
        }
    }
    return out;
}

function parseStateDerivatives(raw: unknown): readonly string[] {
    if (!Array.isArray(raw)) return [];
    const out: string[] = [];
    for (const it of raw) if (typeof it === 'string') out.push(it);
    return out;
}

function parseConditionsEntry(raw: unknown): DatasetEntry<ConditionEntity> | undefined {
    if (!isRecord(raw)) return undefined;
    const itemsRaw = Array.isArray(raw['items']) ? (raw['items'] as unknown[]) : [];
    const items: ConditionEntity[] = [];
    for (const it of itemsRaw) {
        if (!isRecord(it)) continue;
        const id = it['id'];
        const name = it['name'];
        if (typeof id !== 'string' || typeof name !== 'string') continue;
        items.push({
            id,
            name,
            treated_with: parseTreatedWith(it['treated_with']),
        });
    }
    return {
        version: stringField(raw['version']),
        itemCount: numberField(raw['item_count'], items.length),
        items,
    };
}

function parseMedicationsEntry(raw: unknown): DatasetEntry<MedicationEntity> | undefined {
    if (!isRecord(raw)) return undefined;
    const itemsRaw = Array.isArray(raw['items']) ? (raw['items'] as unknown[]) : [];
    const items: MedicationEntity[] = [];
    for (const it of itemsRaw) {
        if (!isRecord(it)) continue;
        const id = it['id'];
        const name = it['name'];
        if (typeof id !== 'string' || typeof name !== 'string') continue;
        items.push({
            id,
            name,
            used_for: parseUsedFor(it['used_for']),
        });
    }
    return {
        version: stringField(raw['version']),
        itemCount: numberField(raw['item_count'], items.length),
        items,
    };
}

function parseGenericEntry(raw: unknown): DatasetEntry | undefined {
    if (!isRecord(raw)) return undefined;
    const itemsRaw = Array.isArray(raw['items']) ? (raw['items'] as unknown[]) : [];
    const items: ReferenceEntity[] = [];
    for (const it of itemsRaw) {
        if (!isRecord(it)) continue;
        const id = it['id'];
        const name = it['name'];
        if (typeof id === 'string' && typeof name === 'string') items.push({ id, name });
    }
    return {
        version: stringField(raw['version']),
        itemCount: numberField(raw['item_count'], items.length),
        items,
    };
}

function parseSpellingCorrectionsEntry(raw: unknown): DatasetEntry<SpellingCorrectionEntity> | undefined {
    if (!isRecord(raw)) return undefined;
    const itemsRaw = Array.isArray(raw['items']) ? (raw['items'] as unknown[]) : [];
    const items: SpellingCorrectionEntity[] = [];
    for (const it of itemsRaw) {
        if (!isRecord(it)) continue;
        const id = it['id'];
        const from = it['from'];
        const to = it['to'];
        if (typeof id !== 'string' || typeof from !== 'string' || typeof to !== 'string') continue;
        const name = typeof it['name'] === 'string' ? (it['name'] as string) : from;
        items.push({ id, name, from, to });
    }
    return {
        version: stringField(raw['version']),
        itemCount: numberField(raw['item_count'], items.length),
        items,
    };
}

function parseNicotineOptionsEntry(raw: unknown): DatasetEntry<NicotineOptionEntity> | undefined {
    if (!isRecord(raw)) return undefined;
    const itemsRaw = Array.isArray(raw['items']) ? (raw['items'] as unknown[]) : [];
    const items: NicotineOptionEntity[] = [];
    for (const it of itemsRaw) {
        if (!isRecord(it)) continue;
        const id = it['id'];
        const name = it['name'];
        if (typeof id !== 'string' || typeof name !== 'string') continue;
        items.push({ id, name, type: parseNicotineType(it['type']) });
    }
    return {
        version: stringField(raw['version']),
        itemCount: numberField(raw['item_count'], items.length),
        items,
    };
}

function parseNicotineType(raw: unknown): NicotineOptionEntity['type'] {
    if (raw === 'smoked' || raw === 'smokeless' || raw === 'vapor') return raw;
    return 'other';
}

function parseTreatedWith(raw: unknown): readonly ConditionTreatedWith[] {
    if (!Array.isArray(raw)) return [];
    const out: ConditionTreatedWith[] = [];
    for (const it of raw) {
        if (!isRecord(it)) continue;
        const id = it['id'];
        const name = it['name'];
        const pc = it['prescription_count'];
        if (typeof id !== 'string' || typeof name !== 'string') continue;
        out.push({
            id,
            name,
            prescription_count: parsePrescriptionCount(pc),
        });
    }
    return out;
}

function parseUsedFor(raw: unknown): readonly MedicationUsedFor[] {
    if (!Array.isArray(raw)) return [];
    const out: MedicationUsedFor[] = [];
    for (const it of raw) {
        if (!isRecord(it)) continue;
        const id = it['id'];
        const name = it['name'];
        const pc = it['prescription_count'];
        if (typeof id !== 'string' || typeof name !== 'string') continue;
        out.push({
            id,
            name,
            prescription_count: parsePrescriptionCount(pc),
        });
    }
    return out;
}

function stringField(raw: unknown): string {
    return typeof raw === 'string' ? raw : '';
}

function numberField(raw: unknown, fallback: number): number {
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
}

function parsePrescriptionCount(raw: unknown): number {
    return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
}

export class DatasetsV3SubClient {
    constructor(private readonly ctx: OperationContext) {}
    get(options?: DatasetsV3GetOptions): Promise<DatasetBundleV3 | DatasetsV3NotModified> {
        return getDatasetsV3(options, this.ctx);
    }
}
