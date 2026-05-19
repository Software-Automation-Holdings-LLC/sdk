/**
 * Idempotency-key derivation for Tier 3.
 *
 * ADR-035 invariant: idempotency keys are derived, not supplied.
 *
 *   key = sha256(<deviceId> : <op> : <canonical-body>)
 *
 * The derived key is stable across retries for the same logical request, so
 * the SDK's bounded retry layer (and a caller's app-level retry) cannot
 * cause duplicate work on the server side. Callers MAY override with a
 * custom key for advanced cases (replay testing); the default never asks
 * the caller to "make one up".
 */
/** Derive the deterministic idempotency key for a Tier 3 operation. */
export declare function deriveIdempotencyKey(args: {
    deviceId: string;
    op: string;
    body: string;
    subtle?: SubtleCrypto;
}): Promise<string>;
//# sourceMappingURL=idempotency.d.ts.map