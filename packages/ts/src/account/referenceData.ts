/**
 * `isa.account.referenceData` — engine reference data lookups.
 *
 * Three wire paths, one typed surface:
 *
 *   scope === 'dataset'           → `GET   /dataset/{dataset}`
 *   scope === 'compiled_data_v2'  → `POST  /v1/reference-data`
 *   scope === 'compiled_data_v3'  → `POST  /v2/reference-data`
 *   (other scope values)          → `POST  /v1/reference-data`
 *
 * The scope value is forwarded to the server in the request body for the
 * POST paths so the server can dispatch to the right compiled-data version.
 * For the GET path the `dataset` field selects the dataset by name; no body
 * is sent.
 *
 * Return shape is the server's verbatim JSON, unwrapped from the standard
 * `{ data: ... }` envelope when present. The common case is
 * `{ datasets: { ... } }`; some endpoints return a flat record. The SDK
 * does not interpret the payload — callers pick the fields they need.
 */

import { type AuthContext } from './auth';
import { type Transport } from '../zyins/transport';
import { fromHttpResponse } from '../zyins/errors';
import { deriveIdempotencyKey } from '../zyins/idempotency';
import { unwrapEnvelope } from '../zyins/response';
import { buildLicenseHMACHeaders } from '../core';
import { type Clock, systemClock } from '../core';

const REFERENCE_V1_PATH = '/v1/reference-data';
const REFERENCE_V2_PATH = '/v2/reference-data';
const DATASET_PREFIX = '/dataset/';

/** Inputs for `account.referenceData.get`. */
export interface ReferenceDataRequest {
  /**
   * Server-side dispatcher key. `'dataset'` routes to `GET /dataset/{name}`.
   * `'compiled_data_v2'` routes to `POST /v1/reference-data`.
   * `'compiled_data_v3'` routes to `POST /v2/reference-data`. Other values
   * default to `/v1/reference-data` for forward compatibility.
   */
  scope: string;
  /** Required when `scope === 'dataset'`. Names the dataset to fetch. */
  dataset?: string;
  /** Optional caller-supplied filters / parameters; forwarded as the POST body. */
  payload?: Record<string, unknown>;
}

/**
 * Response shape — opaque to the SDK. Common case is
 * `{ datasets: { name1: [...], name2: {...}, ... } }`; some scopes return
 * a flat record. Callers down-cast.
 */
export type ReferenceDataResult = Record<string, unknown>;

export interface ReferenceDataContext {
  baseUrl: string;
  auth: AuthContext;
  transport: Transport;
  clock: Clock;
}

/** Fetch reference data per the supplied scope. */
export async function get(
  request: ReferenceDataRequest,
  ctx: ReferenceDataContext,
): Promise<ReferenceDataResult> {
  if (!request || typeof request.scope !== 'string' || request.scope.length === 0) {
    throw new Error('account: referenceData.get requires a non-empty scope');
  }
  if (request.scope === 'dataset') {
    return fetchDataset(request, ctx);
  }
  return postReferenceData(request, ctx);
}

async function fetchDataset(
  request: ReferenceDataRequest,
  ctx: ReferenceDataContext,
): Promise<ReferenceDataResult> {
  if (typeof request.dataset !== 'string' || request.dataset.length === 0) {
    throw new Error('account: referenceData.get(scope=dataset) requires a dataset name');
  }
  const path = `${DATASET_PREFIX}${encodeURIComponent(request.dataset)}`;
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
    return parseReferenceBody(response.body);
  }
  throw fromHttpResponse(response.status, response.body);
}

async function postReferenceData(
  request: ReferenceDataRequest,
  ctx: ReferenceDataContext,
): Promise<ReferenceDataResult> {
  const path = pathForScope(request.scope);
  const wire: Record<string, unknown> =
    request.payload === undefined
      ? { scope: request.scope }
      : { ...request.payload, scope: request.scope };
  const body = JSON.stringify(wire);
  const idempotencyKey = await deriveIdempotencyKey({
    deviceId: ctx.auth.deviceId,
    op: `reference_data:${path}`,
    body,
  });
  const headers = await buildLicenseHMACHeaders(
    ctx.auth.licenseKey,
    ctx.auth.orderId,
    ctx.auth.email,
    'POST',
    path,
    body,
    ctx.auth.deviceId,
    ctx.clock ?? systemClock,
  );
  const response = await ctx.transport({
    url: `${ctx.baseUrl}${path}`,
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
    return parseReferenceBody(response.body);
  }
  throw fromHttpResponse(response.status, response.body);
}

function pathForScope(scope: string): string {
  if (scope === 'compiled_data_v3') return REFERENCE_V2_PATH;
  return REFERENCE_V1_PATH;
}

function parseReferenceBody(body: string): ReferenceDataResult {
  if (!body) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    throw new Error(`account: reference-data response was not valid JSON: ${(err as Error).message}`);
  }
  const root = unwrapEnvelope(parsed);
  if (root && typeof root === 'object' && !Array.isArray(root)) {
    return root as ReferenceDataResult;
  }
  return { data: root };
}

