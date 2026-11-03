/**
 * Prototype-independent error brands.
 *
 * The guards in {@link ./apiError} test for these brands instead of
 * `instanceof` so they keep working when the error crossed a module boundary
 * that produced a second copy of the class — a vendored tarball, a test
 * mock, or a duplicated dependency tree all yield distinct prototypes, which
 * breaks `instanceof` but not a string-keyed brand. This is the same
 * prototype-independent pattern Stripe ships as
 * `Stripe.errors.StripeError.isStripeError`.
 *
 * The brands are non-enumerable so they never leak into JSON, logs, or
 * `Object.keys`. They are intentionally plain string keys (not `Symbol`s):
 * a Symbol minted in one module copy is `!==` the Symbol minted in another,
 * which would reintroduce the exact cross-copy failure the brand exists to
 * defeat.
 */
/** Brand stamped on {@link IsaApiError} and every subclass. */
export const API_ERROR_BRAND = "__isaApiError";
/** Brand stamped on {@link IsaNotActivatedError}. */
export const NOT_ACTIVATED_BRAND = "__isaNotActivatedError";
/** Brand stamped on {@link IsaIdempotencyConflictError}. */
export const IDEMPOTENCY_CONFLICT_BRAND = "__isaIdempotencyConflictError";
/** Stamp a non-enumerable `true` brand onto an instance. */
export function brand(target, key) {
    Object.defineProperty(target, key, {
        value: true,
        enumerable: false,
        writable: false,
        configurable: false,
    });
}
/** True when `value` carries a non-enumerable own `key` set to `true`. */
export function hasBrand(value, key) {
    return (typeof value === "object"
        && value !== null
        && Object.hasOwn(value, key)
        && value[key] === true);
}
//# sourceMappingURL=errorBrand.js.map