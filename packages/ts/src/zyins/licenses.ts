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
import { fromHttpResponse } from './errors';
import { deriveIdempotencyKey } from './idempotency';
import { parseJsonResponse, unwrapEnvelope as unwrapParsedEnvelope } from './response';
import { buildLicenseHMACHeaders } from '../core';
import { type Clock, systemClock } from '../core';

const LICENSES_ACTIVATE_PATH = '/v1/licenses/activate';
const LICENSES_CHECK_PATH = '/v1/licenses/check';
const LICENSES_DEACTIVATE_PATH = '/v1/licenses/deactivate';
const DEACTIVATED_STATUS = 'deactivated';

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
export async function activate(
  request: LicensesActivateRequest,
  ctx: LicensesContext,
): Promise<LicensesActivateResult> {
  validateActivateRequest(request);
  const body = JSON.stringify(serializeActivate(request));
  const requestCtx: LicensesContext = {
    ...ctx,
    auth: { ...ctx.auth, deviceId: request.deviceId },
  };
  const idempotencyKey =
    ctx.idempotencyKey ??
    (await deriveIdempotencyKey({ deviceId: request.deviceId, op: 'licenses_activate', body }));
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
  request: LicensesCheckRequest,
  ctx: LicensesContext,
): Promise<LicensesCheckResult> {
  validateCheckRequest(request);
  const body = JSON.stringify(serializeCheck(request));
  const idempotencyKey =
    ctx.idempotencyKey ??
    (await deriveIdempotencyKey({ deviceId: ctx.auth.deviceId, op: 'licenses_check', body }));
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
  request: LicensesDeactivateRequest,
  ctx: LicensesContext,
): Promise<LicensesDeactivateResult> {
  validateDeactivateRequest(request);
  const body = JSON.stringify(serializeDeactivate(request));
  const idempotencyKey =
    ctx.idempotencyKey ??
    (await deriveIdempotencyKey({ deviceId: ctx.auth.deviceId, op: 'licenses_deactivate', body }));
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

function validateActivateRequest(request: LicensesActivateRequest): void {
  if (!request.email?.trim()) {
    throw new Error('zyins: licenses.activate requires email');
  }
  if (!request.keycode?.trim()) {
    throw new Error('zyins: licenses.activate requires keycode');
  }
  if (!request.deviceId?.trim()) {
    throw new Error('zyins: licenses.activate requires deviceId');
  }
}

function validateCheckRequest(request: LicensesCheckRequest): void {
  if (!request.email?.trim()) {
    throw new Error('zyins: licenses.check requires email');
  }
  if (!request.keycode?.trim()) {
    throw new Error('zyins: licenses.check requires keycode');
  }
}

function validateDeactivateRequest(request: LicensesDeactivateRequest): void {
  if (!request.email?.trim()) {
    throw new Error('zyins: licenses.deactivate requires email');
  }
  if (!request.keycode?.trim()) {
    throw new Error('zyins: licenses.deactivate requires keycode');
  }
}

function serializeActivate(request: LicensesActivateRequest): Record<string, string> {
  return {
    email: request.email,
    keycode: request.keycode,
    device_id: request.deviceId,
  };
}

function serializeCheck(request: LicensesCheckRequest): Record<string, string> {
  const payload: Record<string, string> = {
    email: request.email,
    keycode: request.keycode,
  };
  if (request.deviceId) payload['device_id'] = request.deviceId;
  if (request.licenseKey) payload['license_key'] = request.licenseKey;
  return payload;
}

function serializeDeactivate(request: LicensesDeactivateRequest): Record<string, string> {
  const payload: Record<string, string> = {
    email: request.email,
    keycode: request.keycode,
  };
  if (request.deviceId) payload['device_id'] = request.deviceId;
  return payload;
}

function parseActivate(body: string): LicensesActivateResult {
  const data = unwrapEnvelope(body) as {
    status?: unknown;
    remainingActivations?: unknown;
    auth?: unknown;
  };
  const status = data.status;
  if (typeof status !== 'string' || status === '') {
    throw new Error('zyins: licenses.activate response missing status field');
  }
  const remaining = data.remainingActivations;
  if (typeof remaining !== 'number') {
    throw new Error('zyins: licenses.activate response missing remainingActivations');
  }
  const auth = data.auth;
  if (!auth || typeof auth !== 'object') {
    throw new Error('zyins: licenses.activate response missing auth block');
  }
  const licenseKey = (auth as { licenseKey?: unknown }).licenseKey;
  if (typeof licenseKey !== 'string' || licenseKey === '') {
    throw new Error('zyins: licenses.activate response missing auth.licenseKey');
  }
  return {
    status,
    auth: { licenseKey },
    remainingActivations: remaining,
  };
}

function parseCheck(body: string): LicensesCheckResult {
  const data = unwrapEnvelope(body);
  const status = (data as { status?: unknown }).status;
  if (typeof status !== 'string') {
    throw new Error(`zyins: licenses.check response missing status field`);
  }
  return { status: status as LicenseValidationStatus };
}

function parseDeactivate(body: string): LicensesDeactivateResult {
  const data = unwrapEnvelope(body);
  const status = (data as { status?: unknown }).status;
  if (status !== DEACTIVATED_STATUS) {
    throw new Error('zyins: licenses.deactivate response missing deactivated status');
  }
  return { status };
}

function unwrapEnvelope(body: string): unknown {
  if (!body) {
    throw new Error('zyins: licenses response body was empty');
  }
  return unwrapParsedEnvelope(parseJsonResponse(body, 'licenses'));
}

async function buildHeaders(args: {
  ctx: LicensesContext;
  body: string;
  path: string;
  idempotencyKey: string;
}): Promise<Record<string, string>> {
  const signed = await buildLicenseHMACHeaders(
    args.ctx.auth.licenseKey,
    args.ctx.auth.orderId,
    args.ctx.auth.email,
    'POST',
    args.path,
    args.body,
    args.ctx.auth.deviceId,
    args.ctx.clock ?? systemClock,
  );
  return {
    ...signed,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Idempotency-Key': args.idempotencyKey,
  };
}
