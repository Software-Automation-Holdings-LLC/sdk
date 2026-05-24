/**
 * Client-version negotiation surface.
 *
 * The server emits two response headers — `X-Client-Current` (latest known
 * SDK build hash) and `X-Client-Minimum` (strict floor). When the consumer
 * has supplied a `clientVersion` to {@link Isa}, the transport compares the
 * consumer's identifier against these signals and emits a typed event:
 *   - `hard` — the consumer is below the server-mandated minimum and must
 *     upgrade before the next call succeeds reliably.
 *   - `soft` — the consumer is behind the published current but still
 *     accepted; upgrade at convenience.
 *
 * Hashes are opaque. The comparison is identity-based: equal strings mean
 * "this version", anything else means "treat the server's signal as
 * authoritative". The minimum is a strict floor — `ours !== minimum`
 * triggers `hard` regardless of perceived ordering.
 */
/**
 * Evaluate the server's headers against the consumer's claimed version.
 * Returns `undefined` when no mismatch is detected (or no consumer version
 * is supplied).
 *
 * The minimum is a strict floor. If `minimum` is present and the consumer
 * version is not exactly that string, the level is `hard` — we do not
 * attempt to order opaque hashes. If only `current` differs the level is
 * `soft`.
 */
export function evaluateClientVersion(headers, ours) {
    if (!ours)
        return undefined;
    const current = headers['x-client-current'] ?? headers['X-Client-Current'] ?? '';
    const minimum = headers['x-client-minimum'] ?? headers['X-Client-Minimum'] ?? '';
    if (!current && !minimum)
        return undefined;
    if (minimum && ours !== minimum) {
        return { current, minimum, ours, level: 'hard' };
    }
    if (current && ours !== current) {
        return { current, minimum, ours, level: 'soft' };
    }
    return undefined;
}
//# sourceMappingURL=clientVersion.js.map