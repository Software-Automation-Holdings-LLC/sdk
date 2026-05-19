/*
 * Bearer-token transport helper for the unified ISA SDK.
 *
 * Composition pattern mirrors AWS-SDK-JS-v3's middleware stack and the
 * Stripe-node client: a thin wrapper around a caller-supplied fetch
 * implementation that injects `Authorization: Bearer <token>` before
 * delegating. The fetch implementation is constructor-injected so tests
 * can substitute a no-network fake without touching globals.
 */

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
export class StaticToken implements TokenSource {
    constructor(private readonly value: string) {
        if (value === '') {
            throw new Error('transport: StaticToken refuses an empty value');
        }
    }
    token(): string {
        return this.value;
    }
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
export class BearerTransport {
    private readonly source: TokenSource;
    private readonly inner: FetchImpl;

    constructor(opts: BearerTransportOptions) {
        if (!opts.source) {
            throw new Error('transport: BearerTransport requires a TokenSource');
        }
        if (!opts.fetch) {
            throw new Error('transport: BearerTransport requires a fetch implementation');
        }
        this.source = opts.source;
        this.inner = opts.fetch;
    }

    /** Returns a FetchImpl that injects `Authorization: Bearer <token>`. */
    asFetch(): FetchImpl {
        return async (input, init) => {
            const token = await this.source.token();
            const headers = new Headers(init?.headers);
            headers.set('Authorization', `Bearer ${token}`);
            return this.inner(input, { ...init, headers });
        };
    }
}
