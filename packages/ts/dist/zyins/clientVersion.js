/**
 * Client-version negotiation surface.
 *
 * The server emits two response headers — `X-Client-Current` (latest known
 * SDK build hash) and `X-Client-Minimum` (strict floor). When the consumer
 * has supplied a `clientVersion` to {@link Isa}, the transport compares the
 * consumer's identifier against these signals and emits a typed event when the
 * consumer differs from the server's published version signals.
 *
 * Hashes are opaque and cannot be ordered client-side. Differences therefore
 * produce soft notifications only.
 */
/**
 * Evaluate the server's headers against the consumer's claimed version.
 * Returns `undefined` when no mismatch is detected (or no consumer version
 * is supplied).
 *
 * Because the server sends opaque hashes instead of ordered semver values, the
 * SDK cannot prove a non-matching client is below `minimum`; it can only report
 * a soft mismatch.
 */
export function evaluateClientVersion(headers, ours) {
    if (!ours)
        return undefined;
    const current = headers['x-client-current'] ?? headers['X-Client-Current'] ?? '';
    const minimum = headers['x-client-minimum'] ?? headers['X-Client-Minimum'] ?? '';
    if (!current && !minimum)
        return undefined;
    if (current && ours === current)
        return undefined;
    if (current && ours !== current) {
        return { current, minimum, ours, level: 'soft' };
    }
    if (minimum && ours !== minimum) {
        return { current, minimum, ours, level: 'soft' };
    }
    return undefined;
}
//# sourceMappingURL=clientVersion.js.map