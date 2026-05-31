/**
 * `isa.account.preferences` — `GET /v2/preferences/restore` (lookup) and
 * `POST /v2/preferences/backup` (set).
 *
 * Per-license opaque settings document, partitioned by caller-supplied
 * `scope`. bpp2.0 passes `scope: "bpp"`; future surfaces (eApp, agent
 * dashboard) will pass their own value so writes do not stomp each other.
 *
 * The SDK does not interpret the document; callers serialize their own
 * settings shape and pass through. Identity comes from License-HMAC auth
 * headers — body carries no credentials.
 */

import { type AuthContext } from './auth.js';
import { type Transport } from '../zyins/transport.js';
import { fromHttpResponse } from '../zyins/errors.js';
import { deriveIdempotencyKey } from '../zyins/idempotency.js';
import { unwrapEnvelope } from '../zyins/response.js';
import { buildLicenseHMACHeaders } from '../core/index.js';
import { type Clock, systemClock } from '../core/index.js';

const PREFERENCES_RESTORE_PATH = '/v2/preferences/restore';
const PREFERENCES_BACKUP_PATH = '/v2/preferences/backup';

/** Opaque preferences document — keys and values are caller-defined. */
export type PreferencesDocument = Record<string, unknown>;

/** Input for `account.preferences.lookup`. */
export interface PreferencesLookupRequest {
  /** Required partition key. Different surfaces pass different scopes. */
  scope: string;
}

export interface PreferencesLookupResult {
  prefs: PreferencesDocument;
}

/** Input for `account.preferences.set`. */
export interface PreferencesSetRequest {
  /** Required partition key matching the corresponding `lookup`. */
  scope: string;
  /** Document to upsert. */
  prefs: PreferencesDocument;
}

export interface PreferencesSetResult {
  /** True on successful upsert. */
  ok: true;
}

export interface PreferencesContext {
  baseUrl: string;
  auth: AuthContext;
  transport: Transport;
  clock: Clock;
  idempotencyKey?: string;
}

/** Fetch the preferences document for the supplied scope. */
export async function lookup(
  request: PreferencesLookupRequest,
  ctx: PreferencesContext,
): Promise<PreferencesLookupResult> {
  if (!request || typeof request.scope !== 'string' || request.scope.length === 0) {
    throw new Error('account: preferences.lookup requires a non-empty scope');
  }
  const path = `${PREFERENCES_RESTORE_PATH}?scope=${encodeURIComponent(request.scope)}`;
  const headers = await buildLicenseHMACHeaders(
    ctx.auth.licenseKey,
    ctx.auth.orderId,
    ctx.auth.email,
    'GET',
    path,
    '',
    ctx.auth.deviceId,
    ctx.clock ?? systemClock,
  );
  const response = await ctx.transport({
    url: `${ctx.baseUrl}${path}`,
    method: 'GET',
    headers: { ...headers, Accept: 'application/json' },
    body: '',
  });
  if (response.status >= 200 && response.status < 300) {
    return { prefs: parsePrefsBody(response.body) };
  }
  throw fromHttpResponse(response.status, response.body);
}

/** Upsert the preferences document for the supplied scope. */
export async function set(
  request: PreferencesSetRequest,
  ctx: PreferencesContext,
): Promise<PreferencesSetResult> {
  if (!request || typeof request.scope !== 'string' || request.scope.length === 0) {
    throw new Error('account: preferences.set requires a non-empty scope');
  }
  if (!request.prefs || typeof request.prefs !== 'object') {
    throw new Error('account: preferences.set requires a prefs object');
  }
  const body = JSON.stringify({ scope: request.scope, prefs: request.prefs });
  const idempotencyKey =
    ctx.idempotencyKey ??
    (await deriveIdempotencyKey({
      deviceId: ctx.auth.deviceId,
      op: `preferences_set:${request.scope}`,
      body,
    }));
  const headers = await buildLicenseHMACHeaders(
    ctx.auth.licenseKey,
    ctx.auth.orderId,
    ctx.auth.email,
    'POST',
    PREFERENCES_BACKUP_PATH,
    body,
    ctx.auth.deviceId,
    ctx.clock ?? systemClock,
  );
  const response = await ctx.transport({
    url: `${ctx.baseUrl}${PREFERENCES_BACKUP_PATH}`,
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body,
  });
  if (response.status >= 200 && response.status < 300) {
    return { ok: true };
  }
  throw fromHttpResponse(response.status, response.body);
}

/** Parse a `{prefs: {...}}` or enveloped response. Empty body → empty document. */
function parsePrefsBody(body: string): PreferencesDocument {
  if (!body) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    throw new Error(`account: preferences response was not valid JSON: ${(err as Error).message}`);
  }
  const root = unwrapEnvelope(parsed);
  if (root && typeof root === 'object' && 'prefs' in (root as Record<string, unknown>)) {
    const prefs = (root as { prefs: unknown }).prefs;
    if (prefs && typeof prefs === 'object') {
      return prefs as PreferencesDocument;
    }
  }
  if (root && typeof root === 'object') {
    return root as PreferencesDocument;
  }
  return {};
}

