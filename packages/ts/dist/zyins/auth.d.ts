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
 * Identity material for an authenticated ZyINS call.
 *
 * `licenseKey`, `orderId`, and `email` together identify WHICH agent is
 * making the call. `deviceId` is the per-device random string the device
 * received at activation; it is the HMAC signing key for the per-request
 * `X-Device-Signature` header.
 *
 * Values may carry surrounding double-quote characters when sourced from
 * AsyncStorage (the legacy bpp2.0 storage path JSON-serializes strings on
 * write but reads them raw). The protocol layer strips quotes; the Tier 3
 * facade does not.
 */
export interface AuthContext {
    /** BPP license key (e.g., from license activation). */
    licenseKey: string;
    /** Order identifier / keycode (paired with `licenseKey`). */
    orderId: string;
    /** Login email — the agent identity surfaced in analytics and emails. */
    email: string;
    /** Persistent device identifier (random_string). HMAC signing key. */
    deviceId: string;
}
/**
 * Type guard: narrows an unknown value to a usable `AuthContext`.
 *
 * Returns `true` only if all four required fields are present and non-empty
 * strings. Callers that bind auth from storage SHOULD verify with this guard
 * before constructing a `ZyInsClient`; an incomplete context will fail at
 * the first signed request with an unhelpful protocol error.
 */
export declare function isAuthContext(value: unknown): value is AuthContext;
//# sourceMappingURL=auth.d.ts.map