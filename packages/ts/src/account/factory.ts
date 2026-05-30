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

import { type IsaIdentity } from '../zyins/envFactory';
import { IsaConfigError } from '../zyins/apiError';
import { type IsaCredentialState } from '../zyins/credentialState';
import { DEFAULT_ZYINS_BASE_URL } from '../zyins/client';
import { type Transport } from '../zyins/transport';
import { AccountNamespace } from './index';

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
export function buildAccountNamespace(opts: AccountFactoryOptions): AccountNamespace {
  if (opts.identity.mode !== 'license') {
    return throwingNamespace(
      `isa.account.* methods currently require Isa.withKeycode() — bearer and session transport wiring lands in Phase 3 of SDK_DESIGN.md`,
    );
  }
  if (!opts.deviceId) {
    return throwingNamespace(
      `isa.account.* methods require a deviceId on Isa.withKeycode({ deviceId, orderId, … })`,
    );
  }
  if (!opts.orderId && !opts.credentialState?.auth.orderId) {
    return throwingNamespace(
      `isa.account.* methods require an orderId on Isa.withKeycode({ deviceId, orderId, … })`,
    );
  }
  if (!opts.credentialState) {
    return throwingNamespace(
      `isa.account.* methods require the shared credentialState (constructed by Isa.withKeycode())`,
    );
  }
  // Share the live AuthContext reference owned by IsaCredentialState. When
  // `license.activate()` refreshes the license key, the mutation is observed
  // by every subsequent account.* request without a namespace rebuild.
  return new AccountNamespace({
    auth: opts.credentialState.auth,
    baseUrl: opts.baseUrl ?? DEFAULT_ZYINS_BASE_URL,
    ...(opts.caseViewerBaseUrl !== undefined && { caseViewerBaseUrl: opts.caseViewerBaseUrl }),
    ...(opts.transport !== undefined && { transport: opts.transport }),
  });
}

/**
 * Build an `AccountNamespace` whose every method throws the same
 * `IsaConfigError` — used when the unified `Isa` was constructed with
 * insufficient credentials for account.* calls. The error fires at call
 * time, not construction, so `isa.account` itself is always non-null.
 */
function throwingNamespace(message: string): AccountNamespace {
  const throwConfigError = () => {
    throw new IsaConfigError(message);
  };
  return {
    branding: { lookup: throwConfigError },
    preferences: { lookup: throwConfigError, set: throwConfigError },
    cases: {
      create: throwConfigError,
      open: throwConfigError,
      list: throwConfigError,
      email: throwConfigError,
    },
    email: { enqueue: throwConfigError },
  } as unknown as AccountNamespace;
}
