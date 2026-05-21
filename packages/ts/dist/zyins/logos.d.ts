/**
 * Tier 3 logos operations — `GET /v1/logos/{carrier}`.
 *
 * Static carrier-brand assets. Per `api-standards.md` (GET allowlist), the
 * endpoint is non-credentialed: the SDK does NOT attach auth headers. Two
 * response shapes are negotiated via the `?ds=` query parameter:
 *
 *   - `?ds=true`  → server returns a `data:image/...;base64,...` text body.
 *   - default     → server returns the raw image bytes (typically PNG/JPEG).
 *
 * The SDK presents a single call surface (`get(carrier, { dataUri? })`) and
 * branches internally on `dataUri` to return the right shape:
 *
 *   - `dataUri: true`   → resolves to `string` (the data URI).
 *   - `dataUri` omitted → resolves to `Blob` (the raw bytes).
 *
 * Callers never juggle two shapes. The branch is encoded in the call site
 * via an overload so TypeScript narrows the return type at the call.
 *
 * 404 — when the carrier has no logo asset — surfaces as a typed
 * `ZyInsError` with code `not_found`, matching the rest of the Tier 3 funnel.
 */
/** Options accepted by {@link get}. */
export interface LogosGetOptions {
    /**
     * When `true`, returns the asset as a `data:` URI string. When omitted or
     * `false`, returns the raw bytes as a `Blob`. The SDK branches on this
     * field so the caller never has to handle both shapes at one call site.
     */
    dataUri?: boolean;
}
/**
 * Pluggable fetcher used by {@link get}. Tests inject a stub so the call
 * never touches `globalThis.fetch`. Production wires `resolveFetch()` so
 * the default behaves identically to the rest of the SDK.
 */
export type LogosFetch = (url: string) => Promise<LogosResponse>;
/** Minimal response shape the logos module needs from a fetcher. */
export interface LogosResponse {
    status: number;
    /** Read the body as a text string. Used for data-URI responses. */
    text(): Promise<string>;
    /** Read the body as a Blob. Used for raw-bytes responses. */
    blob(): Promise<Blob>;
}
/** Per-call context for the logos sub-client. */
export interface LogosContext {
    baseUrl: string;
    /** Optional fetcher override; defaults to `globalThis.fetch`. */
    fetchImpl?: LogosFetch;
}
/**
 * Fetch the carrier-logo asset.
 *
 * Overloads encode the dataUri branch into the return type so the caller
 * never gets `Blob | string` and never has to widen-then-narrow.
 */
export declare function get(carrier: string, opts: LogosGetOptions & {
    dataUri: true;
}, ctx: LogosContext): Promise<string>;
export declare function get(carrier: string, opts: (LogosGetOptions & {
    dataUri?: false | undefined;
}) | undefined, ctx: LogosContext): Promise<Blob>;
export declare function get(carrier: string, opts: LogosGetOptions | undefined, ctx: LogosContext): Promise<Blob | string>;
/**
 * Sub-client wrapping {@link get} for use from {@link ZyInsClient}. Kept in
 * this file so `client.ts` stays under the 250-line cap.
 */
export declare class LogosSubClient {
    private readonly baseUrl;
    private readonly fetchImpl;
    constructor(baseUrl: string, fetchImpl: LogosFetch | undefined);
    /** Fetch the carrier-logo asset with return type narrowed by `dataUri`. */
    get(carrier: string, opts: LogosGetOptions & {
        dataUri: true;
    }): Promise<string>;
    get(carrier: string, opts?: LogosGetOptions & {
        dataUri?: false | undefined;
    }): Promise<Blob>;
    get(carrier: string, opts?: LogosGetOptions): Promise<Blob | string>;
}
//# sourceMappingURL=logos.d.ts.map