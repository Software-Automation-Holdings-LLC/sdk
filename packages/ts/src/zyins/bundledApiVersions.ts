/**
 * Per-surface bundled API-version table.
 *
 * Each ZyINS surface (prequalify, quote, datasets, reference, sessions,
 * branding, cases) advances on its own schedule; one surface moving to `v3`
 * does not move the others. There is no single "current" API version, so
 * the SDK exposes no global shorthand.
 *
 * `BundledApiVersions` is the per-SDK-release auditable table: it answers
 * "what does this release talk to by default?" without inspecting the wire.
 *
 * Per-call resolution:
 *   `options.apiVersion?.[surface] ?? BundledApiVersions[surface]`
 *
 * There is **no** shorthand string form (`apiVersion: 'v3'`) and **no**
 * `default` key — both would assert a uniformity that does not exist
 * across surfaces.
 *
 * @see docs/sdk-syntax-proposal.md §2.7 (per-surface apiVersion map)
 */

/**
 * The set of ZyINS API surfaces that carry an independent version. Adding
 * a new surface here requires the same addition to {@link BundledApiVersions}.
 */
export type IsaApiSurface =
  | 'prequalify'
  | 'quote'
  | 'datasets'
  | 'reference'
  | 'sessions'
  | 'branding'
  | 'cases';

/** Major-version token sent in the `Api-Version` request header. */
export type IsaApiVersion = 'v1' | 'v2' | 'v3';

/**
 * Per-surface override accepted on `IsaCreateOptions.apiVersion` and the
 * legacy factory `IsaFactoryOptions.apiVersion`. Surfaces absent from the
 * override fall back to {@link BundledApiVersions}.
 */
export type IsaApiVersionOverride = Partial<Readonly<Record<IsaApiSurface, IsaApiVersion>>>;

/**
 * Auditable per-release default for every surface. Frozen — consumers that
 * need a different value for one surface pass an
 * {@link IsaApiVersionOverride} on construction; they do not mutate this.
 */
export const BundledApiVersions: Readonly<Record<IsaApiSurface, IsaApiVersion>> = Object.freeze({
  prequalify: 'v2',
  quote: 'v2',
  datasets: 'v2',
  reference: 'v2',
  sessions: 'v1',
  branding: 'v1',
  cases: 'v1',
});

/**
 * Resolves a per-surface version by overlaying an optional override onto
 * the bundled defaults. Pure; returns a fresh object so callers can hold
 * the result without aliasing {@link BundledApiVersions}.
 */
export function resolveApiVersions(
  override?: IsaApiVersionOverride,
): Readonly<Record<IsaApiSurface, IsaApiVersion>> {
  if (!override) return BundledApiVersions;
  return Object.freeze({
    prequalify: override.prequalify ?? BundledApiVersions.prequalify,
    quote: override.quote ?? BundledApiVersions.quote,
    datasets: override.datasets ?? BundledApiVersions.datasets,
    reference: override.reference ?? BundledApiVersions.reference,
    sessions: override.sessions ?? BundledApiVersions.sessions,
    branding: override.branding ?? BundledApiVersions.branding,
    cases: override.cases ?? BundledApiVersions.cases,
  });
}

/**
 * Path-prefix → surface routing table for transport-level version pinning.
 * Ordered most-specific-first so `/v1/case/list` matches `cases` before
 * any future `/v1/...` catchall.
 */
const SURFACE_PATH_PREFIXES: ReadonlyArray<readonly [string, IsaApiSurface]> = Object.freeze([
  ['/v1/case', 'cases'],
  ['/v2/case', 'cases'],
  ['/v1/branding', 'branding'],
  ['/v2/branding', 'branding'],
  ['/v1/sessions', 'sessions'],
  ['/v2/sessions', 'sessions'],
  ['/v1/datasets', 'datasets'],
  ['/v2/datasets', 'datasets'],
  ['/v3/datasets', 'datasets'],
  ['/v1/reference', 'reference'],
  ['/v2/reference', 'reference'],
  ['/v3/reference', 'reference'],
  ['/v1/quote', 'quote'],
  ['/v2/quote', 'quote'],
  ['/v3/quote', 'quote'],
  ['/v1/prequalify', 'prequalify'],
  ['/v2/prequalify', 'prequalify'],
  ['/v3/prequalify', 'prequalify'],
] as const);

/**
 * Map a request path to the surface that owns it. Returns `undefined` for
 * paths that are not surface-scoped (e.g. `/v1/logos`, `/v1/email/enqueue`,
 * `/v1/licenses/*` — these are infrastructure endpoints with no per-surface
 * versioning override).
 */
export function surfaceForPath(path: string): IsaApiSurface | undefined {
  for (const [prefix, surface] of SURFACE_PATH_PREFIXES) {
    if (path.startsWith(prefix)) return surface;
  }
  return undefined;
}
