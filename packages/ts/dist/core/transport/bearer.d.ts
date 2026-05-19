/** Minimal subset of the WHATWG fetch surface this module depends on. */
export type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
/** Resolves the bearer credential for the next request. May refresh. */
export interface TokenSource {
    /** Returns the bearer token. Throw to fail the request. */
    token(): Promise<string> | string;
}
/**
 * A TokenSource that returns the same token forever. Suitable for
 * short-lived CLI smoke tests; production callers should pass a
 * refreshing implementation that handles token expiry.
 */
export declare class StaticToken implements TokenSource {
    private readonly value;
    constructor(value: string);
    token(): string;
}
export interface BearerTransportOptions {
    /** Token source. Required. */
    source: TokenSource;
    /** Underlying fetch. Required (do NOT default to global fetch). */
    fetch: FetchImpl;
}
/**
 * BearerTransport wraps a fetch implementation, attaching the bearer
 * token header unconditionally. Any pre-existing Authorization header
 * is overwritten — matching how AWS SigV4 and Google ADC behave.
 */
export declare class BearerTransport {
    private readonly source;
    private readonly inner;
    constructor(opts: BearerTransportOptions);
    /** Returns a FetchImpl that injects `Authorization: Bearer <token>`. */
    asFetch(): FetchImpl;
}
//# sourceMappingURL=bearer.d.ts.map