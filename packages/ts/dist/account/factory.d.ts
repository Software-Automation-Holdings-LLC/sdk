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
import { type IsaIdentity } from '../zyins/envFactory.js';
import { type IsaCredentialState } from '../zyins/credentialState.js';
import { type Transport } from '../zyins/transport.js';
import { AccountNamespace } from './index.js';
/** Inputs the unified `Isa` factory hands down for namespace construction. */
export interface AccountFactoryOptions {
    identity: IsaIdentity;
    baseUrl?: string;
    deviceId?: string;
    orderId?: string;
    /**
     * Shared credential state owned by `Isa`. The account namespace consumes
     * `credentialState.auth` directly so the live `licenseKey` (mutated in
     * place by `isa.zyins.license.activate()`) is observed without rebuilding
     * the namespace.
     */
    credentialState?: IsaCredentialState;
    transport?: Transport;
    /** Viewer origin for case share links; forwarded to {@link AccountNamespace}. */
    caseViewerBaseUrl?: string;
}
/** Build the `isa.account` namespace from the unified `Isa` options. */
export declare function buildAccountNamespace(opts: AccountFactoryOptions): AccountNamespace;
//# sourceMappingURL=factory.d.ts.map