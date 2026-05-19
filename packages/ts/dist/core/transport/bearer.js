/*
 * Bearer-token transport helper for the unified ISA SDK.
 *
 * Composition pattern mirrors AWS-SDK-JS-v3's middleware stack and the
 * Stripe-node client: a thin wrapper around a caller-supplied fetch
 * implementation that injects `Authorization: Bearer <token>` before
 * delegating. The fetch implementation is constructor-injected so tests
 * can substitute a no-network fake without touching globals.
 */
/**
 * A TokenSource that returns the same token forever. Suitable for
 * short-lived CLI smoke tests; production callers should pass a
 * refreshing implementation that handles token expiry.
 */
export class StaticToken {
    value;
    constructor(value) {
        this.value = value;
        if (value === '') {
            throw new Error('transport: StaticToken refuses an empty value');
        }
    }
    token() {
        return this.value;
    }
}
/**
 * BearerTransport wraps a fetch implementation, attaching the bearer
 * token header unconditionally. Any pre-existing Authorization header
 * is overwritten — matching how AWS SigV4 and Google ADC behave.
 */
export class BearerTransport {
    source;
    inner;
    constructor(opts) {
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
    asFetch() {
        return async (input, init) => {
            const token = await this.source.token();
            const headers = new Headers(init?.headers);
            headers.set('Authorization', `Bearer ${token}`);
            return this.inner(input, { ...init, headers });
        };
    }
}
//# sourceMappingURL=bearer.js.map