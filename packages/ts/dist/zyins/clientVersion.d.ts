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
/** Server-emitted client-version mismatch event. */
export interface ClientVersionStatus {
    /** Server's "latest" hash from `X-Client-Current`. */
    current: string;
    /** Server's "minimum acceptable" hash from `X-Client-Minimum`. */
    minimum: string;
    /** Consumer-supplied identifier (Isa constructor option). */
    ours: string;
    level: 'soft';
}
/** Listener registered via `Isa.onClientVersionMismatch`. */
export type ClientVersionListener = (status: ClientVersionStatus) => void;
/**
 * Evaluate the server's headers against the consumer's claimed version.
 * Returns `undefined` when no mismatch is detected (or no consumer version
 * is supplied).
 *
 * Because the server sends opaque hashes instead of ordered semver values, the
 * SDK cannot prove a non-matching client is below `minimum`; it can only report
 * a soft mismatch.
 */
export declare function evaluateClientVersion(headers: Record<string, string>, ours: string | undefined): ClientVersionStatus | undefined;
//# sourceMappingURL=clientVersion.d.ts.map