/**
 * Pluggable source for the v3 reference bundle.
 *
 * Today the reference layer (`conditions.match` / `medications.match` /
 * `autocomplete` / fuzzy / autocorrect) is warmed only by a live
 * `datasets.get()` HTTP call. A {@link DatasetSource} lets the same layer
 * load from a local artifact — offline, inside the engine, or anywhere a
 * network round-trip is undesirable. The contract is a single async
 * `load(): Promise<DatasetBundleV3>`; how the bytes arrive is the source's
 * business.
 *
 * Three implementations ship:
 *   - {@link FileDatasetSource} — read a file, parse with the EXISTING
 *     {@link parseEnvelope} (no second parser).
 *   - {@link ApiDatasetSource} — the current `datasets.get()` HTTP path.
 *   - {@link ResolvingDatasetSource} — try sources in order, first success
 *     wins. Documented chain: local file → optional generate hook → API.
 *
 * Default behavior is unchanged: when a caller supplies no source, the SDK
 * uses {@link ApiDatasetSource} exactly as before.
 */
import type { DatasetBundleV3 } from "./datasets-v3.js";
/**
 * A source the reference layer can load a {@link DatasetBundleV3} from.
 * Implementations resolve the bundle however they like — HTTP, a local
 * file, an in-memory value — and surface one async method.
 */
export interface DatasetSource {
    /**
     * Resolve the bundle. Rejects with a descriptive error naming the
     * source and the failing input when the bundle cannot be produced.
     */
    load(): Promise<DatasetBundleV3>;
}
/**
 * Reads a UTF-8 text file by path. Injectable so the file source stays
 * testable without touching the disk and so non-Node runtimes can supply
 * their own reader. The name describes WHAT (read a file) not HOW (which
 * runtime API backs it).
 */
export type FileReader = (path: string) => Promise<string>;
/**
 * Default file reader. Lazily imports `node:fs/promises` so the symbol is
 * tree-shakeable and never evaluated in a browser bundle that does not use
 * {@link FileDatasetSource}. Throws a typed {@link DatasetSourceError} when
 * no filesystem is available (browser) or the read fails.
 */
export declare const platformFileReader: FileReader;
/** Thrown when a {@link DatasetSource} cannot resolve a bundle. */
export declare class DatasetSourceError extends Error {
    constructor(message: string, options?: {
        cause?: unknown;
    });
}
/**
 * Loads the bundle from a local file and parses it with the shared
 * {@link parseEnvelope}. Accepts the slim `reference-bundle.json` OR the
 * full `datasets.json` — both carry the same `data.datasets` shape; the
 * reference layer reads only the reference fields. The file has no ETag,
 * so the parsed bundle's `etag` is `undefined` and the `version` token
 * (from `data.catalog_version` / `data.version`) drives staleness checks.
 */
export declare class FileDatasetSource implements DatasetSource {
    private readonly path;
    private readonly readFile;
    constructor(path: string, readFile?: FileReader);
    load(): Promise<DatasetBundleV3>;
}
/**
 * Loads the bundle from a caller-supplied async function — the current
 * `datasets.get()` HTTP path. Uses the already-configured client
 * credential; it introduces no new service key. The namespace wires the
 * fetcher to its lazy `DatasetsFacade`.
 */
export declare class ApiDatasetSource implements DatasetSource {
    private readonly fetchBundle;
    constructor(fetchBundle: () => Promise<DatasetBundleV3>);
    load(): Promise<DatasetBundleV3>;
}
/**
 * A source backed by a bundle already in memory. Lets a caller who has
 * parsed a bundle themselves feed it in without re-reading or re-fetching.
 */
export declare class StaticDatasetSource implements DatasetSource {
    private readonly bundle;
    constructor(bundle: DatasetBundleV3);
    load(): Promise<DatasetBundleV3>;
}
/** Optional hook invoked between local-file and API steps of the chain. */
export type OnMissingHook = () => Promise<void>;
/**
 * Tries each source in order; the first that resolves wins. The
 * documented chain is local file → optional generate hook → API fallback:
 * pass the generate hook as `onMissing` and it runs once, after the first
 * source fails and before the next is tried, so an integrator can wire it
 * to a "build the local artifact" command. When every source fails, throws
 * a {@link DatasetSourceError} naming each attempt and its cause.
 */
export declare class ResolvingDatasetSource implements DatasetSource {
    private readonly sources;
    private readonly onMissing;
    constructor(sources: readonly DatasetSource[], options?: {
        onMissing?: OnMissingHook;
    });
    load(): Promise<DatasetBundleV3>;
    private runOnMissing;
}
/**
 * Accepted shorthands for the `datasets` factory option. A string is a
 * file path; a bundle is used directly; a {@link DatasetSource} is used as
 * given. Omitting the option keeps today's API-fetch default.
 */
export type DatasetSourceInput = DatasetSource | DatasetBundleV3 | string;
/**
 * Normalize a {@link DatasetSourceInput} into a {@link DatasetSource}. A
 * string becomes a {@link FileDatasetSource}; an in-memory bundle becomes
 * a {@link StaticDatasetSource}; an already-built source passes through.
 */
export declare function toDatasetSource(input: DatasetSourceInput): DatasetSource;
//# sourceMappingURL=datasetSource.d.ts.map