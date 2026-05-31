/**
 * Signed-request dispatch for the `/v1/case` operations. Centralizes the
 * License-HMAC header construction + transport call so each operation in
 * `cases.ts` only assembles its body and routes status codes.
 */

import { type AuthContext } from './auth.js';
import { type Transport } from '../zyins/transport.js';
import { deriveIdempotencyKey } from '../zyins/idempotency.js';
import { buildLicenseHMACHeaders, type Clock, systemClock } from '../core/index.js';

/** The auth + transport context a signed case request needs. */
export interface TCaseRequestContext {
  baseUrl: string;
  auth: AuthContext;
  transport: Transport;
  clock: Clock;
  idempotencyKey?: string;
}

/** A single signed `/v1/case` request: method, path, body, and idempotency. */
export interface TSignedRequestSpec {
  method: 'GET' | 'POST';
  path: string;
  body: string;
  /** When set, an `Idempotency-Key` is derived (or taken from ctx) for the op. */
  idempotencyOp?: string;
}

/** Shape of a transport response after success/error status routing. */
export type TTransportResponse = Awaited<ReturnType<Transport>>;

/**
 * Build License-HMAC headers and dispatch one `/v1/case` request, eliminating
 * the per-operation header/transport boilerplate. The caller routes status
 * codes — this helper only signs and sends.
 */
export async function signedCaseRequest(
  spec: TSignedRequestSpec,
  ctx: TCaseRequestContext,
): Promise<TTransportResponse> {
  const headers = await buildLicenseHMACHeaders(
    ctx.auth.licenseKey,
    ctx.auth.orderId,
    ctx.auth.email,
    spec.method,
    spec.path,
    spec.body,
    ctx.auth.deviceId,
    ctx.clock ?? systemClock,
  );
  const requestHeaders: Record<string, string> = { ...headers, Accept: 'application/json' };
  if (spec.method === 'POST') requestHeaders['Content-Type'] = 'application/json';
  if (spec.idempotencyOp !== undefined) {
    requestHeaders['Idempotency-Key'] =
      ctx.idempotencyKey ??
      (await deriveIdempotencyKey({
        deviceId: ctx.auth.deviceId,
        op: spec.idempotencyOp,
        body: spec.body,
      }));
  }
  return ctx.transport({
    url: `${ctx.baseUrl}${spec.path}`,
    method: spec.method,
    headers: requestHeaders,
    body: spec.body,
  });
}

/** True when an HTTP status is a 2xx success. */
export function isSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}
