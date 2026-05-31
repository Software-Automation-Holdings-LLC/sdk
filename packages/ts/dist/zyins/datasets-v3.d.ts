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
import type { OperationContext } from './client.js';
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
export declare function isNotModified(result: DatasetBundleV3 | DatasetsV3NotModified): result is DatasetsV3NotModified;
/**
 * Build the canonical typo map from a bundle's `spellingCorrections`.
 *
 * Keys and values are both UPPERCASE; consumers MUST uppercase their
 * inputs before lookup. Conventionally fed into
 * {@link DefaultAutocorrector}.
 */
export declare function buildTypoMap(bundle: Pick<DatasetBundleV3, 'spellingCorrections'>): ReadonlyMap<string, string>;
/**
 * Aggregate per-id prescription frequency from inline rows.
 *
 * For each condition: sum of `treated_with[].prescription_count`.
 * For each medication: sum of `used_for[].prescription_count`.
 *
 * Consumers feed this into {@link AutocompleteAlgorithm.rank} as the
 * `frequencies` map.
 */
export declare function buildFrequencyMap(bundle: Pick<DatasetBundleV3, 'conditions' | 'medications'>): ReadonlyMap<string, number>;
export declare function getDatasetsV3(options: DatasetsV3GetOptions | undefined, ctx: OperationContext): Promise<DatasetBundleV3 | DatasetsV3NotModified>;
export declare class DatasetsV3SubClient {
    private readonly ctx;
    constructor(ctx: OperationContext);
    get(options?: DatasetsV3GetOptions): Promise<DatasetBundleV3 | DatasetsV3NotModified>;
}
//# sourceMappingURL=datasets-v3.d.ts.map