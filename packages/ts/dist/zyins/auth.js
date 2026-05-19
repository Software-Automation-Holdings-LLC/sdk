/**
 * Tier 3 ZyINS auth context.
 *
 * Carries the four identifiers every authenticated ZyINS call needs:
 * licenseKey, orderId, email, and the per-device deviceId used as the HMAC
 * signing key. The protocol layer (`../license/deviceAuth`) consumes this
 * context to build per-request headers; the Tier 3 facade owns context
 * resolution so call sites never touch headers.
 *
 * The facade supports two idioms (ADR-035 §"Tier 3 idioms"):
 *
 * 1. Context-bound — `useZyIns()` (React/Vue) reads context from
 *    provider/composable wiring. Call sites never see auth.
 * 2. Explicit-context — `new ZyInsClient({ auth })` (CLI, server). Caller
 *    constructs the context once and passes it at client construction.
 *
 * Both idioms reduce to the same `AuthContext` shape so the underlying
 * client logic is parallel.
 */
/**
 * Type guard: narrows an unknown value to a usable `AuthContext`.
 *
 * Returns `true` only if all four required fields are present and non-empty
 * strings. Callers that bind auth from storage SHOULD verify with this guard
 * before constructing a `ZyInsClient`; an incomplete context will fail at
 * the first signed request with an unhelpful protocol error.
 */
export function isAuthContext(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const v = value;
    return (typeof v.licenseKey === 'string' &&
        v.licenseKey.length > 0 &&
        typeof v.orderId === 'string' &&
        v.orderId.length > 0 &&
        typeof v.email === 'string' &&
        v.email.length > 0 &&
        typeof v.deviceId === 'string' &&
        v.deviceId.length > 0);
}
//# sourceMappingURL=auth.js.map