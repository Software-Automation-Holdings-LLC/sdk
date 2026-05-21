/**
 * Tier 3 licenses operations — proto-backed (`/v1/licenses/activate`,
 * `/v1/licenses/check`, `/v1/licenses/deactivate`).
 *
 * This module exists alongside the legacy `license.ts` module, which
 * targets the deprecated `/v1/licensing` CGI surface. New code SHOULD
 * use this `licenses` (plural) sub-client; the legacy `license`
 * (singular) sub-client is retained for backward compatibility with
 * bpp2.0's `useSoftwareActivator` and is marked `@deprecated`.
 *
 * The proto definitions for the request and response shapes live in
 * `shared/schemas/api/zyins/v1/licenses.proto`.
 */
import { type AuthContext } from './auth';
import { type Transport } from './transport';
import { type Clock } from '../core';
/** Mirror of proto `LicenseStatus`. Unknown wire values surface as-is. */
export type LicenseValidationStatus = string;
/** Inputs accepted by `licenses.activate`. */
export interface LicensesActivateRequest {
    /** Email associated with the license. Required. */
    email: string;
    /** BPP order keycode in XXX-XXX-XXX format. Required. */
    keycode: string;
    /** Client-generated device fingerprint. Required. */
    deviceId: string;
}
/** Auth block surfaced inside an activation response. */
export interface LicensesActivateAuth {
    /** License key minted (or reused) for this activation. */
    licenseKey: string;
}
/** Output of `licenses.activate`. */
export interface LicensesActivateResult {
    /** Activation outcome (`active` on success; unknown values surface as-is). */
    status: string;
    /** Auth credentials minted for the device. */
    auth: LicensesActivateAuth;
    /** Device activations remaining on the order after this call. */
    remainingActivations: number;
}
/** Inputs accepted by `licenses.check`. */
export interface LicensesCheckRequest {
    /** Email associated with the license. Required. */
    email: string;
    /** BPP order keycode in XXX-XXX-XXX format. Required. */
    keycode: string;
    /** Optional client-generated device fingerprint. */
    deviceId?: string;
    /** Optional license key to verify (deterministic regeneration). */
    licenseKey?: string;
}
/** Output of `licenses.check`. */
export interface LicensesCheckResult {
    /** Validation outcome. Unknown wire values surface as-is. */
    status: LicenseValidationStatus;
}
/** Inputs accepted by `licenses.deactivate`. */
export interface LicensesDeactivateRequest {
    /** Email associated with the license. Required. */
    email: string;
    /** BPP order keycode. Required. */
    keycode: string;
    /** Optional device fingerprint; reset on success. */
    deviceId?: string;
}
/** Output of `licenses.deactivate`. */
export interface LicensesDeactivateResult {
    /** Always `deactivated` on success. */
    status: string;
}
/** Shared knobs the client passes through to a licenses call. */
export interface LicensesContext {
    baseUrl: string;
    auth: AuthContext;
    transport: Transport;
    clock: Clock;
    /** Optional Idempotency-Key override; default derives from body. */
    idempotencyKey?: string;
}
/**
 * Activate a license on a new device. The server mints a license key,
 * decrements the order's remaining-activations counter, and returns
 * pre-built credentials.
 */
export declare function activate(request: LicensesActivateRequest, ctx: LicensesContext): Promise<LicensesActivateResult>;
/**
 * Run the public phone-home check. The server does not require
 * authentication; an attached bearer/HMAC header is harmless and lets
 * one client struct serve every operation.
 */
export declare function check(request: LicensesCheckRequest, ctx: LicensesContext): Promise<LicensesCheckResult>;
/**
 * Run the public deactivation. Marks the activation inactive and
 * resets the anti-piracy device record.
 */
export declare function deactivate(request: LicensesDeactivateRequest, ctx: LicensesContext): Promise<LicensesDeactivateResult>;
//# sourceMappingURL=licenses.d.ts.map