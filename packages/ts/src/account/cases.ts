/**
 * `isa.account.cases` — case CRUD + share over `/v1/case`.
 *
 *   create  → `POST   /v1/case`
 *   get     → `GET    /v1/case/{id}`
 *   list    → `GET    /v1/case`
 *   email   → `POST   /v1/case/{id}/email`
 *
 * Cases are content-addressed shareable artifacts created from a quote
 * input + results + selected products. The server hashes the tuple —
 * identical inputs dedupe to the same `hash` regardless of which license
 * created the case.
 */

import { type AuthContext } from './auth';
import { type Transport } from '../zyins/transport';
import { fromHttpResponse } from '../zyins/errors';
import { deriveIdempotencyKey } from '../zyins/idempotency';
import { isRecord, stringField, unwrapEnvelope } from '../zyins/response';
import { buildLicenseHMACHeaders } from '../core';
import { type Clock, systemClock } from '../core';

const CASES_PATH = '/v1/case';

/** Inputs for `account.cases.create`. */
export interface CaseCreateRequest {
  /** Quote input — object converted to XML server-side, or raw XML string. */
  input: Record<string, unknown> | string;
  /** Optional quote results payload. */
  results?: unknown;
  /** Optional product selection (array of product identifiers). */
  products?: string[];
}

export interface CaseCreateResult {
  /** Content-addressed case identifier. */
  hash: string;
  /** Absolute share URL for the case viewer. */
  url: string;
  /** True when the case is read-only (created by another license). */
  readonly: boolean;
  /** RFC 3339 timestamp the case was first created. */
  createdAt: string;
}

/** A case as returned by `get` / `list`. */
export interface CaseSummary {
  hash: string;
  url: string;
  readonly: boolean;
  createdAt: string;
  /** Optional original input (server returns when caller owns the case). */
  input?: unknown;
  /** Optional results payload (server returns when present). */
  results?: unknown;
  /** Optional product selection (server returns when present). */
  products?: string[];
}

/** Inputs for `account.cases.email`. */
export interface CaseEmailRequest {
  caseId: string;
  to: string;
}

export interface CaseEmailResult {
  queued: true;
}

export interface CasesContext {
  baseUrl: string;
  auth: AuthContext;
  transport: Transport;
  clock: Clock;
  idempotencyKey?: string;
}

/** Create a new shareable case. */
export async function create(
  request: CaseCreateRequest,
  ctx: CasesContext,
): Promise<CaseCreateResult> {
  if (
    !request ||
    request.input === undefined ||
    request.input === null ||
    (typeof request.input === 'string' && request.input.trim().length === 0)
  ) {
    throw new Error('account: cases.create requires input');
  }
  const wire: Record<string, unknown> = { input: request.input };
  if (request.results !== undefined) wire['results'] = request.results;
  if (request.products !== undefined) wire['products'] = request.products;
  const body = JSON.stringify(wire);
  const idempotencyKey =
    ctx.idempotencyKey ??
    (await deriveIdempotencyKey({ deviceId: ctx.auth.deviceId, op: 'cases_create', body }));
  const headers = await buildLicenseHMACHeaders(
    ctx.auth.licenseKey,
    ctx.auth.orderId,
    ctx.auth.email,
    'POST',
    CASES_PATH,
    body,
    ctx.auth.deviceId,
    ctx.clock ?? systemClock,
  );
  const response = await ctx.transport({
    url: `${ctx.baseUrl}${CASES_PATH}`,
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
    return parseCreateResponse(response.body);
  }
  throw fromHttpResponse(response.status, response.body);
}

/** Retrieve a single case by hash. */
export async function get(caseId: string, ctx: CasesContext): Promise<CaseSummary> {
  if (typeof caseId !== 'string' || caseId.length === 0) {
    throw new Error('account: cases.get requires a non-empty case id');
  }
  const path = `${CASES_PATH}/${encodeURIComponent(caseId)}`;
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
    return parseCaseSummary(response.body);
  }
  throw fromHttpResponse(response.status, response.body);
}

/** List all cases visible to the caller. */
export async function list(ctx: CasesContext): Promise<CaseSummary[]> {
  const headers = await buildLicenseHMACHeaders(
    ctx.auth.licenseKey,
    ctx.auth.orderId,
    ctx.auth.email,
    'GET',
    CASES_PATH,
    '',
    ctx.auth.deviceId,
    ctx.clock ?? systemClock,
  );
  const response = await ctx.transport({
    url: `${ctx.baseUrl}${CASES_PATH}`,
    method: 'GET',
    headers: { ...headers, Accept: 'application/json' },
    body: '',
  });
  if (response.status >= 200 && response.status < 300) {
    return parseCaseList(response.body);
  }
  throw fromHttpResponse(response.status, response.body);
}

/** Email a case PDF / artifact to a recipient. */
export async function email(
  request: CaseEmailRequest,
  ctx: CasesContext,
): Promise<CaseEmailResult> {
  if (!request || typeof request.caseId !== 'string' || request.caseId.length === 0) {
    throw new Error('account: cases.email requires a non-empty caseId');
  }
  if (typeof request.to !== 'string' || request.to.length === 0) {
    throw new Error('account: cases.email requires a non-empty to address');
  }
  const path = `${CASES_PATH}/${encodeURIComponent(request.caseId)}/email`;
  const body = JSON.stringify({ to: request.to });
  const idempotencyKey =
    ctx.idempotencyKey ??
    (await deriveIdempotencyKey({
      deviceId: ctx.auth.deviceId,
      op: `cases_email:${request.caseId}`,
      body,
    }));
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
    return { queued: true };
  }
  throw fromHttpResponse(response.status, response.body);
}

function parseCreateResponse(body: string): CaseCreateResult {
  if (!body) {
    throw new Error('account: cases.create response body was empty');
  }
  const parsed = parseCaseJson(body, 'account: cases.create');
  const root = caseRecord(parsed, 'account: cases.create');
  return {
    hash: stringField(root, 'hash'),
    url: stringField(root, 'url'),
    readonly: root['readonly'] === true,
    createdAt: stringField(root, 'created_at'),
  };
}

function parseCaseSummary(body: string): CaseSummary {
  if (!body) {
    throw new Error('account: cases.get response body was empty');
  }
  const parsed = parseCaseJson(body, 'account: cases.get');
  const root = caseRecord(parsed, 'account: cases.get');
  return summaryFromRecord(root);
}

function parseCaseList(body: string): CaseSummary[] {
  if (!body) return [];
  const parsed = parseCaseJson(body, 'account: cases.list');
  const root = unwrapEnvelope(parsed);
  if (Array.isArray(root)) {
    return root.map((entry) => summaryFromRecord(entry as Record<string, unknown>));
  }
  if (root && typeof root === 'object' && 'cases' in (root as Record<string, unknown>)) {
    const cases = (root as { cases: unknown }).cases;
    if (Array.isArray(cases)) {
      return cases.map((entry) => summaryFromRecord(entry as Record<string, unknown>));
    }
  }
  return [];
}

function parseCaseJson(body: string, context: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch (err) {
    throw new Error(`${context} response was not valid JSON: ${(err as Error).message}`);
  }
}

function caseRecord(parsed: unknown, context: string): Record<string, unknown> {
  const root = unwrapEnvelope(parsed);
  if (!isRecord(root)) {
    throw new Error(`${context} response body was not a JSON object`);
  }
  return root;
}

function summaryFromRecord(r: Record<string, unknown>): CaseSummary {
  const out: CaseSummary = {
    hash: stringField(r, 'hash'),
    url: stringField(r, 'url'),
    readonly: r['readonly'] === true,
    createdAt: stringField(r, 'created_at'),
  };
  if (r['input'] !== undefined) out.input = r['input'];
  if (r['results'] !== undefined) out.results = r['results'];
  if (Array.isArray(r['products'])) out.products = r['products'] as string[];
  return out;
}

