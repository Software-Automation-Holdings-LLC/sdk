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
import { parseEnvelope } from "./datasets-v3.js";

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
export const platformFileReader: FileReader = async (path: string) => {
  let fs: typeof import("node:fs/promises");
  try {
    fs = await import("node:fs/promises");
  } catch (err) {
    throw new DatasetSourceError(
      `FileDatasetSource: no filesystem available to read ${path} (this runtime has no node:fs)`,
      { cause: err },
    );
  }
  try {
    return await fs.readFile(path, "utf8");
  } catch (err) {
    throw new DatasetSourceError(
      `FileDatasetSource: failed to read ${path}`,
      { cause: err },
    );
  }
};

/** Thrown when a {@link DatasetSource} cannot resolve a bundle. */
export class DatasetSourceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DatasetSourceError";
  }
}

/**
 * Loads the bundle from a local file and parses it with the shared
 * {@link parseEnvelope}. Accepts the slim `reference-bundle.json` OR the
 * full `datasets.json` — both carry the same `data.datasets` shape; the
 * reference layer reads only the reference fields. The file has no ETag,
 * so the parsed bundle's `etag` is `undefined` and the `version` token
 * (from `data.catalog_version` / `data.version`) drives staleness checks.
 */
export class FileDatasetSource implements DatasetSource {
  constructor(
    private readonly path: string,
    private readonly readFile: FileReader = platformFileReader,
  ) {}

  async load(): Promise<DatasetBundleV3> {
    const body = await this.readFile(this.path);
    try {
      return parseEnvelope(body, undefined);
    } catch (err) {
      throw new DatasetSourceError(
        `FileDatasetSource: failed to parse ${this.path} as a v3 dataset bundle`,
        { cause: err },
      );
    }
  }
}

/**
 * Loads the bundle from a caller-supplied async function — the current
 * `datasets.get()` HTTP path. Uses the already-configured client
 * credential; it introduces no new service key. The namespace wires the
 * fetcher to its lazy `DatasetsFacade`.
 */
export class ApiDatasetSource implements DatasetSource {
  constructor(private readonly fetchBundle: () => Promise<DatasetBundleV3>) {}

  load(): Promise<DatasetBundleV3> {
    return this.fetchBundle();
  }
}

/**
 * A source backed by a bundle already in memory. Lets a caller who has
 * parsed a bundle themselves feed it in without re-reading or re-fetching.
 */
export class StaticDatasetSource implements DatasetSource {
  constructor(private readonly bundle: DatasetBundleV3) {}

  load(): Promise<DatasetBundleV3> {
    return Promise.resolve(this.bundle);
  }
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
export class ResolvingDatasetSource implements DatasetSource {
  private readonly sources: readonly DatasetSource[];
  private readonly onMissing: OnMissingHook | undefined;

  constructor(sources: readonly DatasetSource[], options?: { onMissing?: OnMissingHook }) {
    if (sources.length === 0) {
      throw new DatasetSourceError(
        "ResolvingDatasetSource: at least one source is required",
      );
    }
    this.sources = sources;
    this.onMissing = options?.onMissing;
  }

  async load(): Promise<DatasetBundleV3> {
    const failures: string[] = [];
    for (let i = 0; i < this.sources.length; i += 1) {
      const source = this.sources[i];
      if (source === undefined) continue;
      try {
        return await source.load();
      } catch (err) {
        failures.push(describeFailure(source, err));
      }
      if (i === 0 && this.onMissing !== undefined) {
        await this.runOnMissing(failures);
      }
    }
    throw new DatasetSourceError(
      `ResolvingDatasetSource: every source failed — ${failures.join("; ")}`,
    );
  }

  private async runOnMissing(failures: string[]): Promise<void> {
    try {
      await (this.onMissing as OnMissingHook)();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`onMissing hook threw: ${message}`);
    }
  }
}

function describeFailure(source: DatasetSource, err: unknown): string {
  const kind = source.constructor.name;
  const message = err instanceof Error ? err.message : String(err);
  return `${kind} failed (${message})`;
}

/**
 * Accepted shorthands for the `datasets` factory option. A string is a
 * file path; a bundle is used directly; a {@link DatasetSource} is used as
 * given. Omitting the option keeps today's API-fetch default.
 */
export type DatasetSourceInput = DatasetSource | DatasetBundleV3 | string;

const isDatasetSource = (value: DatasetSourceInput): value is DatasetSource =>
  typeof value === "object" && value !== null && typeof (value as DatasetSource).load === "function";

/**
 * Normalize a {@link DatasetSourceInput} into a {@link DatasetSource}. A
 * string becomes a {@link FileDatasetSource}; an in-memory bundle becomes
 * a {@link StaticDatasetSource}; an already-built source passes through.
 */
export function toDatasetSource(input: DatasetSourceInput): DatasetSource {
  if (typeof input === "string") return new FileDatasetSource(input);
  if (isDatasetSource(input)) return input;
  return new StaticDatasetSource(input);
}
