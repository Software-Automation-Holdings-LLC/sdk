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
export type IsaApiSurface = 'prequalify' | 'quote' | 'datasets' | 'reference' | 'sessions' | 'branding' | 'cases';
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
export declare const BundledApiVersions: Readonly<Record<IsaApiSurface, IsaApiVersion>>;
/**
 * Resolves a per-surface version by overlaying an optional override onto
 * the bundled defaults. Pure; returns a fresh object so callers can hold
 * the result without aliasing {@link BundledApiVersions}.
 */
export declare function resolveApiVersions(override?: IsaApiVersionOverride): Readonly<Record<IsaApiSurface, IsaApiVersion>>;
/**
 * Map a request path to the surface that owns it. Returns `undefined` for
 * paths that are not surface-scoped (e.g. `/v1/logos`, `/v1/email/enqueue`,
 * `/v1/licenses/*` — these are infrastructure endpoints with no per-surface
 * versioning override).
 */
export declare function surfaceForPath(path: string): IsaApiSurface | undefined;
//# sourceMappingURL=bundledApiVersions.d.ts.map