/**
 * Tier 3 license operations — LEGACY CGI surface (`/v1/licensing`).
 *
 * @deprecated Use the proto-backed `licenses` (plural) sub-client
 * (`./licenses.ts`) for new code. The new sub-client targets
 * `/v1/licenses/check` and `/v1/licenses/deactivate`, which return
 * structured JSON instead of the legacy CGI `ERR_*` plain-text
 * dialect. This module remains for backward compatibility with
 * bpp2.0's `useSoftwareActivator.js`.
 *
 * Replaces the 7-branch ERR_* if-chain in bpp2.0's `useSoftwareActivator.js`
 * with three typed methods (`activate`, `deactivate`, `check`) and one
 * typed-error funnel (`LicenseError`). The CGI's `text/plain` ERR_* dialect
 * is absorbed by `fromHttpResponse`; the Tier 3 caller switches on
 * `LicenseError.code` instead of comparing strings.
 */
import { type AuthContext } from './auth';
import { type Transport } from './transport';
import { type Clock } from '../core';
export interface LicenseActivateResult {
    /** Remaining activations on the order (best-effort; may be undefined). */
    remainingActivations?: number;
}
export interface LicenseCheckResult {
    /** Whether the activation is currently usable. */
    active: boolean;
    /** Remaining activations on the order when known. */
    remainingActivations?: number;
}
/** Shared knobs every license call needs. */
export interface LicenseContext {
    baseUrl: string;
    auth: AuthContext;
    transport: Transport;
    clock: Clock;
}
/**
 * Activate a license on this device. The CGI ERR_* responses are absorbed
 * into `LicenseError` with codes `max_activations` / `inactive` /
 * `active_elsewhere` / `locked` / `invalid_credentials` / `unknown`.
 */
export declare function activate(ctx: LicenseContext): Promise<LicenseActivateResult>;
/** Deactivate the current device's activation. */
export declare function deactivate(ctx: LicenseContext): Promise<void>;
/** Check whether the current activation is still valid. */
export declare function check(ctx: LicenseContext): Promise<LicenseCheckResult>;
//# sourceMappingURL=license.d.ts.map