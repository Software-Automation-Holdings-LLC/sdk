/**
 * Tier 3 prequalify operation.
 *
 * Replaces the inline payload assembly in bpp2.0's `analyzeCase`
 * (`src/lib/data.js:1315`). The before-state spreads HTTP, header, license,
 * and serialization concerns across the call site; this module isolates them.
 *
 * Inputs: a typed `PrequalifyRequest` (applicant, coverage, products).
 * Output: a typed `PrequalifyResult` (plans, ranking, declines).
 *
 * Locked invariants (per ADR-035):
 *  - The wire body is built by the SDK; the call site never sees it.
 *  - The idempotency key is derived from sessionId:op:body-hash.
 *  - Auth credentials live in HMAC headers only — never in the request body.
 *  - Errors are typed; ERR_* strings and ProblemDetails JSON both funnel
 *    through `fromHttpResponse`.
 */

import { type Applicant, NicotineUsage, type NicotineUsageInput, NicotineDuration } from './applicant';
import { type Coverage, QuoteType } from './coverage';
import { type ProductSelection } from './product';
import { type AuthContext } from './auth';
import { type Transport } from './transport';
import { fromHttpResponse } from './errors';
import { deriveIdempotencyKey } from './idempotency';
import { buildLicenseHMACHeaders } from '../core';
import { type Clock, systemClock } from '../core';

/** Inputs accepted by `prequalify`. */
export interface PrequalifyRequest {
  applicant: Applicant;
  coverage: Coverage;
  products: ProductSelection;
}

/** One plan returned by the engine. */
export interface PrequalifyPlan {
  /** Carrier brand (e.g., "colonial-penn"). */
  brand: string;
  /** Plan tier within the carrier (e.g., "preferred-plus"). */
  tier: string;
  /** Monthly premium in USD (the bucketed amount the engine quoted). */
  monthlyPremium: number;
  /** Face value the premium applies to, in whole US dollars. */
  faceValue: number;
  /** Underlying product wire token; useful for routing into eApp. */
  productToken: string;
}

/** Output of `prequalify`. */
export interface PrequalifyResult {
  /** Plans the applicant qualified for, ordered as the engine returns them. */
  plans: ReadonlyArray<PrequalifyPlan>;
  /** Engine request id for correlation with server-side logs. */
  requestId: string;
  /** Idempotency key sent on the wire request. Propagated into the Envelope
   *  so callers can round-trip the key without parsing raw headers. */
  idempotencyKey: string;
}

/** Shared knobs the client passes through to the prequalify call. */
export interface PrequalifyContext {
  baseUrl: string;
  auth: AuthContext;
  transport: Transport;
  clock: Clock;
  /** Optional override; defaults to the derived key (`deriveIdempotencyKey`). */
  idempotencyKey?: string;
}

const PREQUALIFY_PATH = '/v1/prequalify';

/**
 * Run a prequalify call. Builds the wire body, derives the idempotency key,
 * signs the request, and parses the response into typed plans.
 */
export async function prequalify(
  request: PrequalifyRequest,
  ctx: PrequalifyContext,
): Promise<PrequalifyResult> {
  const body = serializeWireBody(request);
  return executePrequalify(body, ctx);
}

async function executePrequalify(
  body: string,
  ctx: PrequalifyContext,
): Promise<PrequalifyResult> {
  const idempotencyKey =
    ctx.idempotencyKey ??
    (await deriveIdempotencyKey({ deviceId: ctx.auth.deviceId, op: 'prequalify', body }));
  const headers = await buildPrequalifyHeaders({
    auth: ctx.auth,
    body,
    idempotencyKey,
    clock: ctx.clock,
  });
  const url = `${ctx.baseUrl}${PREQUALIFY_PATH}`;
  const response = await ctx.transport({ url, method: 'POST', headers, body });
  if (response.status >= 200 && response.status < 300) {
    return { ...parsePrequalifyResponse(response.body), idempotencyKey };
  }
  throw fromHttpResponse(response.status, response.body);
}

/**
 * Serialize the prequalify request to the flat wire body expected by the
 * server. Auth credentials belong in HMAC headers (built separately in
 * `buildPrequalifyHeaders`) — they MUST NOT appear in the body.
 *
 * Wire shape (verified against server PrequalifyRequest struct):
 * ```json
 * {
 *   "date_of_birth": "YYYY-MM-DD",
 *   "gender": "male" | "female",
 *   "height": <inches>,
 *   "weight": <pounds>,
 *   "state": "<state>",
 *   "zip": "<zip>",              // optional
 *   "nicotine_usage": { "last_used": "<NicotineLastUsed>", "product_usage": [...] },
 *   "products": ["<slug>", ...],
 *   "conditions": [...],
 *   "medications": [...],
 *   "quote_options": { "amounts": ["<amount>"], "quote_type": "face_amounts" | "monthly_budget" }
 * }
 * ```
 */
function serializeWireBody(request: PrequalifyRequest): string {
  const { applicant, coverage, products } = request;
  const payload: Record<string, unknown> = {
    date_of_birth: applicant.dob,
    gender: applicant.sex as string,
    height: applicant.height.totalInches,
    weight: applicant.weight.pounds,
    state: applicant.state,
    nicotine_usage: serializeNicotineUsage(applicant.nicotineUse),
    products: products.toWireArray(),
    conditions: applicant.conditions ?? [],
    medications: applicant.medications ?? [],
    quote_options: serializeQuoteOptions(coverage),
  };
  if (applicant.zip !== undefined) {
    payload['zip'] = applicant.zip;
  }
  return JSON.stringify(payload);
}

function serializeNicotineUsage(
  nicotineUse: Applicant['nicotineUse'],
): { last_used: string; product_usage?: Array<{ type: string; frequency: string }> } {
  // Modern structured input
  if (typeof nicotineUse === 'object' && nicotineUse !== null) {
    const input = nicotineUse as NicotineUsageInput;
    const result: { last_used: string; product_usage?: Array<{ type: string; frequency: string }> } = {
      last_used: input.lastUsed as string,
    };
    if (input.productUsage !== undefined && input.productUsage.length > 0) {
      result.product_usage = input.productUsage.map((p) => ({
        type: p.type,
        frequency: p.frequency,
      }));
    }
    return result;
  }

  // Deprecated enum — map to the closest NicotineLastUsed value
  const legacy = nicotineUse as NicotineUsage;
  switch (legacy) {
    case NicotineUsage.None:
      return { last_used: NicotineDuration.Never };
    case NicotineUsage.Current:
      return { last_used: NicotineDuration.Within12Months };
    case NicotineUsage.Former:
      return { last_used: NicotineDuration.N12To24Months };
    default:
      return { last_used: NicotineDuration.Never };
  }
}

function serializeQuoteOptions(
  coverage: Coverage,
): { amounts: string[]; quote_type: string } {
  return {
    amounts: [String(coverage.amount)],
    quote_type: coverage.type === 'face_value' ? QuoteType.FaceAmounts : QuoteType.MonthlyBudget,
  };
}

/** Build the per-request headers (auth + idempotency + content-type). */
async function buildPrequalifyHeaders(args: {
  auth: AuthContext;
  body: string;
  idempotencyKey: string;
  clock: Clock;
}): Promise<Record<string, string>> {
  const licenseHeaders = await buildLicenseHMACHeaders(
    args.auth.licenseKey,
    args.auth.orderId,
    args.auth.email,
    'POST',
    PREQUALIFY_PATH,
    args.body,
    args.auth.deviceId,
    args.clock ?? systemClock,
  );
  return {
    ...licenseHeaders,
    'Content-Type': 'application/json',
    'Idempotency-Key': args.idempotencyKey,
  };
}

const toStr = (v: unknown): string => (typeof v === 'string' ? v : '');
const toNum = (v: unknown): number => (typeof v === 'number' ? v : 0);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Coerce the engine's JSON response into the typed shape. */
function parsePrequalifyResponse(body: string): Omit<PrequalifyResult, 'idempotencyKey'> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    throw new Error(`ZyIns prequalify: failed to parse response body: ${(err as Error).message}`);
  }
  const root = isRecord(parsed) ? parsed : {};
  const plans = Array.isArray(root['plans']) ? root['plans'].map(coercePlan) : [];
  const requestId = toStr(root['request_id']);
  return { plans, requestId };
}

function coercePlan(raw: unknown): PrequalifyPlan {
  const r = isRecord(raw) ? raw : {};
  return {
    brand: toStr(r['brand']),
    tier: toStr(r['tier']),
    monthlyPremium: toNum(r['monthly_premium']),
    faceValue: toNum(r['face_value']),
    productToken: toStr(r['product_token']),
  };
}
