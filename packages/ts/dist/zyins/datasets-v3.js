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
import { buildLicenseHMACHeaders } from '../core/index.js';
import { systemClock } from '../core/index.js';
import { fromHttpResponse } from './errors.js';
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
export function isNotModified(result) {
    return result.notModified === true;
}
/**
 * Build the canonical typo map from a bundle's `spellingCorrections`.
 *
 * Keys and values are both UPPERCASE; consumers MUST uppercase their
 * inputs before lookup. Conventionally fed into
 * {@link DefaultAutocorrector}.
 */
export function buildTypoMap(bundle) {
    const map = new Map();
    for (const row of bundle.spellingCorrections) {
        if (!row.from || !row.to)
            continue;
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
export function buildFrequencyMap(bundle) {
    const map = new Map();
    for (const cond of bundle.conditions) {
        let total = 0;
        for (const row of cond.treated_with)
            total += row.prescription_count;
        map.set(cond.id, total);
    }
    for (const med of bundle.medications) {
        let total = 0;
        for (const row of med.used_for)
            total += row.prescription_count;
        map.set(med.id, total);
    }
    return map;
}
export async function getDatasetsV3(options, ctx) {
    const queryString = buildQueryString(options);
    const pathWithQuery = queryString ? `${DATASETS_V3_PATH}?${queryString}` : DATASETS_V3_PATH;
    const headers = {
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
function buildQueryString(options) {
    if (!options)
        return '';
    const parts = [];
    if (options.include !== undefined) {
        parts.push(`include=${options.include.map(encodeDatasetCategory).join(',')}`);
    }
    if (options.fields !== undefined) {
        parts.push(`fields=${options.fields}`);
    }
    return parts.join('&');
}
function encodeDatasetCategory(category) {
    if (category === 'spelling_corrections')
        return 'corrections';
    return category;
}
function readEtag(headers) {
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === 'etag')
            return value;
    }
    return undefined;
}
// ---------------------------------------------------------------------------
// Parsing — defensive but never lossy.
// ---------------------------------------------------------------------------
const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
function parseEnvelope(body, etag) {
    let parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Invalid JSON response from ${DATASETS_V3_PATH}: ${message}`);
    }
    const root = isRecord(parsed) ? parsed : {};
    const data = isRecord(root['data']) ? root['data'] : {};
    return parseData(data, etag);
}
function parseData(data, etag) {
    const datasetsField = isRecord(data['datasets']) ? data['datasets'] : {};
    const conditionsEntry = parseConditionsEntry(datasetsField['conditions']);
    const medicationsEntry = parseMedicationsEntry(datasetsField['medications']);
    const productsEntry = parseGenericEntry(datasetsField['products']);
    const spellingEntry = parseSpellingCorrectionsEntry(datasetsField['spelling_corrections'] ?? datasetsField['corrections']);
    const nicotineEntry = parseNicotineOptionsEntry(datasetsField['nicotine_options']);
    const datasets = {
        conditions: conditionsEntry,
        medications: medicationsEntry,
        products: productsEntry,
        spelling_corrections: spellingEntry,
        nicotine_options: nicotineEntry,
    };
    return {
        etag,
        version: typeof data['catalog_version'] === 'string' ? data['catalog_version'] : typeof data['version'] === 'string' ? data['version'] : '',
        conditions: conditionsEntry?.items ?? [],
        medications: medicationsEntry?.items ?? [],
        products: productsEntry?.items ?? [],
        spellingCorrections: spellingEntry?.items ?? [],
        nicotineOptions: nicotineEntry?.items ?? [],
        datasets,
        productsByFamily: parseProductsByFamily(data['products_by_family']),
        discontinuedProducts: parseDiscontinuedProducts(data['discontinued_products']),
        stateDerivatives: parseStateDerivatives(data['state_derivatives']),
    };
}
function parseProductsByFamily(raw) {
    if (!isRecord(raw))
        return {};
    const out = {};
    for (const [family, value] of Object.entries(raw)) {
        if (!Array.isArray(value))
            continue;
        const entities = [];
        for (const it of value) {
            if (!isRecord(it))
                continue;
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
function parseDiscontinuedProducts(raw) {
    if (!isRecord(raw))
        return {};
    const out = {};
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
        if (typeof value === 'number' &&
            Number.isInteger(value) &&
            value >= Number.MIN_SAFE_INTEGER &&
            value <= Number.MAX_SAFE_INTEGER) {
            out[slug] = value;
        }
    }
    return out;
}
function parseStateDerivatives(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const it of raw)
        if (typeof it === 'string')
            out.push(it);
    return out;
}
function parseConditionsEntry(raw) {
    if (!isRecord(raw))
        return undefined;
    const itemsRaw = Array.isArray(raw['items']) ? raw['items'] : [];
    const items = [];
    for (const it of itemsRaw) {
        if (!isRecord(it))
            continue;
        const id = it['id'];
        const name = it['name'];
        if (typeof id !== 'string' || typeof name !== 'string')
            continue;
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
function parseMedicationsEntry(raw) {
    if (!isRecord(raw))
        return undefined;
    const itemsRaw = Array.isArray(raw['items']) ? raw['items'] : [];
    const items = [];
    for (const it of itemsRaw) {
        if (!isRecord(it))
            continue;
        const id = it['id'];
        const name = it['name'];
        if (typeof id !== 'string' || typeof name !== 'string')
            continue;
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
function parseGenericEntry(raw) {
    if (!isRecord(raw))
        return undefined;
    const itemsRaw = Array.isArray(raw['items']) ? raw['items'] : [];
    const items = [];
    for (const it of itemsRaw) {
        if (!isRecord(it))
            continue;
        const id = it['id'];
        const name = it['name'];
        if (typeof id === 'string' && typeof name === 'string')
            items.push({ id, name });
    }
    return {
        version: stringField(raw['version']),
        itemCount: numberField(raw['item_count'], items.length),
        items,
    };
}
function parseSpellingCorrectionsEntry(raw) {
    if (!isRecord(raw))
        return undefined;
    const itemsRaw = Array.isArray(raw['items']) ? raw['items'] : [];
    const items = [];
    for (const it of itemsRaw) {
        if (!isRecord(it))
            continue;
        const id = it['id'];
        const from = it['from'];
        const to = it['to'];
        if (typeof id !== 'string' || typeof from !== 'string' || typeof to !== 'string')
            continue;
        const name = typeof it['name'] === 'string' ? it['name'] : from;
        items.push({ id, name, from, to });
    }
    return {
        version: stringField(raw['version']),
        itemCount: numberField(raw['item_count'], items.length),
        items,
    };
}
function parseNicotineOptionsEntry(raw) {
    if (!isRecord(raw))
        return undefined;
    const itemsRaw = Array.isArray(raw['items']) ? raw['items'] : [];
    const items = [];
    for (const it of itemsRaw) {
        if (!isRecord(it))
            continue;
        const id = it['id'];
        const name = it['name'];
        if (typeof id !== 'string' || typeof name !== 'string')
            continue;
        items.push({ id, name, type: parseNicotineType(it['type']) });
    }
    return {
        version: stringField(raw['version']),
        itemCount: numberField(raw['item_count'], items.length),
        items,
    };
}
function parseNicotineType(raw) {
    if (raw === 'smoked' || raw === 'smokeless' || raw === 'vapor')
        return raw;
    return 'other';
}
function parseTreatedWith(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const it of raw) {
        if (!isRecord(it))
            continue;
        const id = it['id'];
        const name = it['name'];
        const pc = it['prescription_count'];
        if (typeof id !== 'string' || typeof name !== 'string')
            continue;
        out.push({
            id,
            name,
            prescription_count: parsePrescriptionCount(pc),
        });
    }
    return out;
}
function parseUsedFor(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const it of raw) {
        if (!isRecord(it))
            continue;
        const id = it['id'];
        const name = it['name'];
        const pc = it['prescription_count'];
        if (typeof id !== 'string' || typeof name !== 'string')
            continue;
        out.push({
            id,
            name,
            prescription_count: parsePrescriptionCount(pc),
        });
    }
    return out;
}
function stringField(raw) {
    return typeof raw === 'string' ? raw : '';
}
function numberField(raw, fallback) {
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
}
function parsePrescriptionCount(raw) {
    return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
}
export class DatasetsV3SubClient {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    get(options) {
        return getDatasetsV3(options, this.ctx);
    }
}
//# sourceMappingURL=datasets-v3.js.map