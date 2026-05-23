/**
 * Tier 3 license operations — proto-backed (`/v1/licenses/activate`,
 * `/v1/licenses/check`, `/v1/licenses/deactivate`).
 *
 * The TS/JS surface is singular (`isa.zyins.license`) — a device has exactly
 * one license, not a collection. The wire paths remain plural for backward
 * compatibility with the deployed server; only the SDK names changed.
 *
 * The proto definitions for the request and response shapes live in
 * `shared/schemas/api/zyins/v1/licenses.proto`.
 */
import { type AuthContext } from './auth';
import { type Transport } from './transport';
import { type Clock } from '../core';
/** Mirror of proto `LicenseStatus`. Unknown wire values surface as-is. */
export type LicenseValidationStatus = string;
/** Inputs accepted by `license.activate`. */
export interface LicenseActivateRequest {
    /** Email associated with the license. Required. */
    email: string;
    /** BPP order keycode in XXX-XXX-XXX format. Required. */
    keycode: string;
    /** Client-generated device fingerprint. Required. */
    deviceId: string;
}
/** Auth block surfaced inside an activation response. */
export interface LicenseActivateAuth {
    /** License key minted (or reused) for this activation. */
    licenseKey: string;
}
/** Output of `license.activate`. */
export interface LicenseActivateResult {
    /** Activation outcome (`active` on success; unknown values surface as-is). */
    status: string;
    /** Auth credentials minted for the device. */
    auth: LicenseActivateAuth;
    /** Device activations remaining on the order after this call. */
    remainingActivations: number;
}
/** Inputs accepted by `license.check`. */
export interface LicenseCheckRequest {
    /** Email associated with the license. Required. */
    email: string;
    /** BPP order keycode in XXX-XXX-XXX format. Required. */
    keycode: string;
    /** Optional client-generated device fingerprint. */
    deviceId?: string;
    /** Optional license key to verify (deterministic regeneration). */
    licenseKey?: string;
}
/** Output of `license.check`. */
export interface LicenseCheckResult {
    /** Validation outcome. Unknown wire values surface as-is. */
    status: LicenseValidationStatus;
}
/** Inputs accepted by `license.deactivate`. */
export interface LicenseDeactivateRequest {
    /** Email associated with the license. Required. */
    email: string;
    /** BPP order keycode. Required. */
    keycode: string;
    /** Optional device fingerprint; reset on success. */
    deviceId?: string;
}
/** Output of `license.deactivate`. */
export interface LicenseDeactivateResult {
    /** Always `deactivated` on success. */
    status: string;
}
/** Shared knobs the client passes through to a licenses call. */
export interface LicenseContext {
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
export declare function activate(request: LicenseActivateRequest, ctx: LicenseContext): Promise<LicenseActivateResult>;
/**
 * Run the public phone-home check. The server does not require
 * authentication; an attached bearer/HMAC header is harmless and lets
 * one client struct serve every operation.
 */
export declare function check(request: LicenseCheckRequest, ctx: LicenseContext): Promise<LicenseCheckResult>;
/**
 * Run the public deactivation. Marks the activation inactive and
 * resets the anti-piracy device record.
 */
export declare function deactivate(request: LicenseDeactivateRequest, ctx: LicenseContext): Promise<LicenseDeactivateResult>;
//# sourceMappingURL=license.d.ts.map