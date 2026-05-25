/**
 * Tier 3 license operations — bootstrap endpoints at
 * `/v2/licenses/{activate,check,deactivate}`.
 *
 * These three operations sit OUTSIDE AuthMiddleware on the server: activate
 * is the call that MINTS the licenseKey, so we cannot sign requests with a
 * credential we do not yet have. Headers carry only Idempotency-Key and the
 * device id; no HMAC signature, no Authorization header.
 *
 * The public TypeScript shape for `LicenseActivateResult` is preserved for
 * bpp2.0's `useSoftwareActivator.js`, which reads `result.auth.licenseKey`.
 * Only the wire parsing adapts to the v2 envelope shape.
 */

import { type AuthContext } from './auth';
import { type Transport } from './transport';
import { fromHttpResponse } from './errors';
import { deriveIdempotencyKey } from './idempotency';
import { parseJsonResponse, unwrapEnvelope as unwrapParsedEnvelope } from './response';
import { stripQuotes } from '../core/license/deviceAuth';
import { type Clock } from '../core';

const LICENSES_ACTIVATE_PATH = '/v2/licenses/activate';
const LICENSES_CHECK_PATH = '/v2/licenses/check';
const LICENSES_DEACTIVATE_PATH = '/v2/licenses/deactivate';
const DEACTIVATED_STATUS = 'inactive';

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
export async function activate(
  request: LicenseActivateRequest,
  ctx: LicenseContext,
): Promise<LicenseActivateResult> {
  validateActivateRequest(request);
  const body = JSON.stringify(serializeActivate(request));
  const requestCtx: LicenseContext = {
    ...ctx,
    auth: { ...ctx.auth, deviceId: request.deviceId },
  };
  const idempotencyKey =
    ctx.idempotencyKey ??
    (await deriveIdempotencyKey({ deviceId: request.deviceId, op: 'license_activate', body }));
  const headers = await buildHeaders({ ctx: requestCtx, body, path: LICENSES_ACTIVATE_PATH, idempotencyKey });
  const response = await ctx.transport({
    url: `${ctx.baseUrl}${LICENSES_ACTIVATE_PATH}`,
    method: 'POST',
    headers,
    body,
  });
  if (response.status >= 200 && response.status < 300) {
    return parseActivate(response.body);
  }
  throw fromHttpResponse(response.status, response.body);
}

/**
 * Run the public phone-home check. The server does not require
 * authentication; an attached bearer/HMAC header is harmless and lets
 * one client struct serve every operation.
 */
export async function check(
  request: LicenseCheckRequest,
  ctx: LicenseContext,
): Promise<LicenseCheckResult> {
  validateCheckRequest(request);
  const body = JSON.stringify(serializeCheck(request));
  const idempotencyKey =
    ctx.idempotencyKey ??
    (await deriveIdempotencyKey({ deviceId: ctx.auth.deviceId, op: 'license_check', body }));
  const headers = await buildHeaders({ ctx, body, path: LICENSES_CHECK_PATH, idempotencyKey });
  const response = await ctx.transport({
    url: `${ctx.baseUrl}${LICENSES_CHECK_PATH}`,
    method: 'POST',
    headers,
    body,
  });
  if (response.status >= 200 && response.status < 300) {
    return parseCheck(response.body);
  }
  throw fromHttpResponse(response.status, response.body);
}

/**
 * Run the public deactivation. Marks the activation inactive and
 * resets the anti-piracy device record.
 */
export async function deactivate(
  request: LicenseDeactivateRequest,
  ctx: LicenseContext,
): Promise<LicenseDeactivateResult> {
  validateDeactivateRequest(request);
  const body = JSON.stringify(serializeDeactivate(request));
  const idempotencyKey =
    ctx.idempotencyKey ??
    (await deriveIdempotencyKey({ deviceId: ctx.auth.deviceId, op: 'license_deactivate', body }));
  const headers = await buildHeaders({ ctx, body, path: LICENSES_DEACTIVATE_PATH, idempotencyKey });
  const response = await ctx.transport({
    url: `${ctx.baseUrl}${LICENSES_DEACTIVATE_PATH}`,
    method: 'POST',
    headers,
    body,
  });
  if (response.status >= 200 && response.status < 300) {
    return parseDeactivate(response.body);
  }
  throw fromHttpResponse(response.status, response.body);
}

function validateActivateRequest(request: LicenseActivateRequest): void {
  if (!request.email?.trim()) {
    throw new Error('zyins: license.activate requires email');
  }
  if (!request.keycode?.trim()) {
    throw new Error('zyins: license.activate requires keycode');
  }
  if (!request.deviceId?.trim()) {
    throw new Error('zyins: license.activate requires deviceId');
  }
}

function validateCheckRequest(request: LicenseCheckRequest): void {
  if (!request.email?.trim()) {
    throw new Error('zyins: license.check requires email');
  }
  if (!request.keycode?.trim()) {
    throw new Error('zyins: license.check requires keycode');
  }
}

function validateDeactivateRequest(request: LicenseDeactivateRequest): void {
  if (!request.email?.trim()) {
    throw new Error('zyins: license.deactivate requires email');
  }
  if (!request.keycode?.trim()) {
    throw new Error('zyins: license.deactivate requires keycode');
  }
}

function serializeActivate(request: LicenseActivateRequest): Record<string, string> {
  return {
    email: request.email,
    keycode: request.keycode,
    deviceId: request.deviceId,
  };
}

function serializeCheck(request: LicenseCheckRequest): Record<string, string> {
  const payload: Record<string, string> = {
    email: request.email,
    keycode: request.keycode,
  };
  if (request.deviceId) payload['deviceId'] = request.deviceId;
  if (request.licenseKey) payload['licenseKey'] = request.licenseKey;
  return payload;
}

function serializeDeactivate(request: LicenseDeactivateRequest): Record<string, string> {
  const payload: Record<string, string> = {
    email: request.email,
    keycode: request.keycode,
  };
  if (request.deviceId) payload['deviceId'] = request.deviceId;
  return payload;
}

function parseActivate(body: string): LicenseActivateResult {
  const data = unwrapEnvelope(body) as {
    status?: unknown;
    licenseKey?: unknown;
    remainingActivations?: unknown;
  };
  const status = data.status;
  if (typeof status !== 'string' || status === '') {
    throw new Error('zyins: license.activate response missing status field');
  }
  const licenseKey = typeof data.licenseKey === 'string' ? data.licenseKey : '';
  const remainingActivations =
    typeof data.remainingActivations === 'number' ? data.remainingActivations : 0;
  return {
    status,
    auth: { licenseKey },
    remainingActivations,
  };
}

function parseCheck(body: string): LicenseCheckResult {
  const data = unwrapEnvelope(body);
  const status = (data as { status?: unknown }).status;
  if (typeof status !== 'string') {
    throw new Error(`zyins: license.check response missing status field`);
  }
  return { status: status as LicenseValidationStatus };
}

function parseDeactivate(body: string): LicenseDeactivateResult {
  const data = unwrapEnvelope(body);
  const status = (data as { status?: unknown }).status;
  // v2 returns "inactive" on success; accept the legacy "deactivated" too
  // so a server still serving the old wire word does not break consumers.
  if (status !== DEACTIVATED_STATUS && status !== 'deactivated') {
    throw new Error('zyins: license.deactivate response missing inactive status');
  }
  return { status: status as string };
}

function unwrapEnvelope(body: string): unknown {
  if (!body) {
    throw new Error('zyins: license response body was empty');
  }
  return unwrapParsedEnvelope(parseJsonResponse(body, 'license'));
}

// buildHeaders emits ONLY the bootstrap-safe headers for the v2 license
// endpoints. These three operations sit outside AuthMiddleware on the
// server: activate is what mints the licenseKey, so signing here would
// require a credential the client does not yet have. The server tracks
// the activation slot by X-Device-ID; no Authorization, no signature.
function buildHeaders(args: {
  ctx: LicenseContext;
  body: string;
  path: string;
  idempotencyKey: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Idempotency-Key': args.idempotencyKey,
  };
  const deviceId = args.ctx.auth.deviceId;
  if (deviceId) {
    headers['X-Device-ID'] = stripQuotes(deviceId);
  }
  return headers;
}
