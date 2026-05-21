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
import { fromHttpResponse, LicenseError } from './errors';
import { buildLicenseHMACHeaders } from '../core';
import { type Clock, systemClock } from '../core';

const LICENSING_PATH = '/v1/licensing';

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
export async function activate(ctx: LicenseContext): Promise<LicenseActivateResult> {
  const body = `action=activate&random_string=${encodeURIComponent(ctx.auth.deviceId)}&email=${encodeURIComponent(ctx.auth.email)}&orderid=${encodeURIComponent(ctx.auth.orderId)}`;
  return call(ctx, body, parseActivateResponse);
}

/** Deactivate the current device's activation. */
export async function deactivate(ctx: LicenseContext): Promise<void> {
  const body = `action=deactivate&random_string=${encodeURIComponent(ctx.auth.deviceId)}&email=${encodeURIComponent(ctx.auth.email)}&orderid=${encodeURIComponent(ctx.auth.orderId)}`;
  await call(ctx, body, () => undefined);
}

/** Check whether the current activation is still valid. */
export async function check(ctx: LicenseContext): Promise<LicenseCheckResult> {
  const body = `action=check&random_string=${encodeURIComponent(ctx.auth.deviceId)}&email=${encodeURIComponent(ctx.auth.email)}&orderid=${encodeURIComponent(ctx.auth.orderId)}`;
  return call(ctx, body, parseCheckResponse);
}

/** Shared call/parse path; ERR_* responses surface as LicenseError. */
async function call<T>(
  ctx: LicenseContext,
  body: string,
  parse: (responseBody: string) => T,
): Promise<T> {
  const headers = await buildHeaders({ ctx, body });
  const response = await ctx.transport({
    url: `${ctx.baseUrl}${LICENSING_PATH}`,
    method: 'POST',
    headers,
    body,
  });
  if (response.status >= 200 && response.status < 300) {
    const trimmed = response.body.trim();
    if (trimmed.startsWith('ERR_') || trimmed === 'NO_EMAIL') {
      // Legacy CGI returns 200 with ERR_* body on logical failures.
      throw fromHttpResponse(response.status, trimmed);
    }
    return parse(trimmed);
  }
  throw fromHttpResponse(response.status, response.body);
}

async function buildHeaders(args: { ctx: LicenseContext; body: string }): Promise<Record<string, string>> {
  const headers = await buildLicenseHMACHeaders(
    args.ctx.auth.licenseKey,
    args.ctx.auth.orderId,
    args.ctx.auth.email,
    'POST',
    LICENSING_PATH,
    args.body,
    args.ctx.auth.deviceId,
    args.ctx.clock ?? systemClock,
  );
  return { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' };
}

/**
 * The legacy CGI returns either:
 *   "SUCCESS:<remaining_activations>"
 * or a raw count, depending on version. We tolerate both.
 */
function parseActivateResponse(body: string): LicenseActivateResult {
  if (body.startsWith('SUCCESS:')) {
    const tail = body.slice('SUCCESS:'.length);
    const remaining = Number.parseInt(tail, 10);
    return Number.isFinite(remaining) ? { remainingActivations: remaining } : {};
  }
  const remaining = Number.parseInt(body, 10);
  return Number.isFinite(remaining) ? { remainingActivations: remaining } : {};
}

function parseCheckResponse(body: string): LicenseCheckResult {
  if (body === 'INACTIVE') return { active: false };
  if (body.startsWith('ACTIVE')) {
    const colonIdx = body.indexOf(':');
    if (colonIdx > 0) {
      const remaining = Number.parseInt(body.slice(colonIdx + 1), 10);
      return Number.isFinite(remaining) ? { active: true, remainingActivations: remaining } : { active: true };
    }
    return { active: true };
  }
  // Conservative fallback: an unexpected body shape on a 2xx response is a
  // protocol-version skew. Surface as LicenseError so the caller does not
  // silently assume "active".
  throw new LicenseError('unknown', `unrecognized license check response: ${body}`);
}
