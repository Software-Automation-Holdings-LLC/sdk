/**
 * Bridge between the unified `Isa` constructor and the License-HMAC
 * `AccountNamespace`. Lives in `account/` (not `zyins/isa.ts`) so the
 * unified factory stays under its 250-line budget and the namespace owns
 * its own construction policy.
 *
 * Today only license identities can call account.* — bearer / session
 * transport wiring lands in Phase 3 of SDK_DESIGN.md. Until then, non-
 * license callers receive a stub namespace whose first method call throws
 * `IsaConfigError` with a description of what's missing.
 */
import { IsaConfigError } from '../zyins/apiError';
import { DEFAULT_ZYINS_BASE_URL } from '../zyins/client';
import { AccountNamespace } from './index';
/** Build the `isa.account` namespace from the unified `Isa` options. */
export function buildAccountNamespace(opts) {
    if (opts.identity.mode !== 'license') {
        return throwingNamespace(`isa.account.* methods currently require Isa.withLicense() — bearer and session transport wiring lands in Phase 3 of SDK_DESIGN.md`);
    }
    if (!opts.deviceId) {
        return throwingNamespace(`isa.account.* methods require a deviceId on Isa.withLicense({ deviceId, orderId, … })`);
    }
    if (!opts.orderId) {
        return throwingNamespace(`isa.account.* methods require an orderId on Isa.withLicense({ deviceId, orderId, … })`);
    }
    const auth = {
        licenseKey: licenseKeyFor(opts.identity),
        orderId: opts.orderId,
        email: opts.identity.email,
        deviceId: opts.deviceId,
    };
    return new AccountNamespace({
        auth,
        baseUrl: opts.baseUrl ?? DEFAULT_ZYINS_BASE_URL,
    });
}
/**
 * The legacy AuthContext field name is `licenseKey`; the modern identity's
 * activation token is `keycode`. They are the same wire value — this
 * helper makes the mapping explicit so callers do not pass the wrong field.
 */
function licenseKeyFor(identity) {
    return identity.keycode;
}
/**
 * Build an `AccountNamespace` whose every method throws the same
 * `IsaConfigError` — used when the unified `Isa` was constructed with
 * insufficient credentials for account.* calls. The error fires at call
 * time, not construction, so `isa.account` itself is always non-null.
 */
function throwingNamespace(message) {
    const throwConfigError = () => {
        throw new IsaConfigError(message);
    };
    return {
        branding: { lookup: throwConfigError },
        preferences: { lookup: throwConfigError, set: throwConfigError },
        cases: {
            create: throwConfigError,
            get: throwConfigError,
            list: throwConfigError,
            email: throwConfigError,
        },
        email: { enqueue: throwConfigError },
        referenceData: { get: throwConfigError },
    };
}
//# sourceMappingURL=factory.js.map