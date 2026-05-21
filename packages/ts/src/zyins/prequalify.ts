/**
 * Tier 3 prequalify operation.
 *
 * Replaces the inline payload assembly in bpp2.0's `analyzeCase`
 * (`src/lib/data.js:1315`). The before-state spreads HTTP, header, license,
 * and serialization concerns across the call site; this module isolates
 * them.
 *
 * Inputs: a typed `PrequalifyRequest` (applicant, coverage, products).
 * Output: a typed `PrequalifyResult` (plans, ranking, declines).
 *
 * Locked invariants (per ADR-035):
 *  - The wire body is built by the SDK; the call site never sees it.
 *  - The idempotency key is derived from sessionId:op:body-hash.
 *  - Errors are typed; ERR_* strings and ProblemDetails JSON both funnel
 *    through `fromHttpResponse`.
 */

import { type Applicant, sexWireCode } from './applicant';
import { type Coverage } from './coverage';
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

/** Inputs accepted by `prequalifyLegacyBlob`. */
export interface PrequalifyLegacyBlobRequest {
  /**
   * The pre-encoded prequalify payload produced by a legacy caller's own
   * encoder (e.g. bpp2.0's `prepEncObj` / `prepEncObjV2`). Serialized to
   * JSON verbatim and sent as the request body.
   */
  encodedPayload: Record<string, unknown>;
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
  const body = serializePrequalifyBody(request, ctx.auth);
  return prequalifyBody(body, ctx);
}

/**
 * Run a prequalify call from a pre-encoded payload. Same path, same
 * headers, same response shape as the typed `prequalify`.
 */
export async function prequalifyLegacyBlob(
  request: PrequalifyLegacyBlobRequest,
  ctx: PrequalifyContext,
): Promise<PrequalifyResult> {
  const body = JSON.stringify(request.encodedPayload);
  return prequalifyBody(body, ctx);
}

async function prequalifyBody(
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
    return parsePrequalifyResponse(response.body);
  }
  throw fromHttpResponse(response.status, response.body);
}

/**
 * Serialize the prequalify request to the wire body. Pulled into a separate
 * function so the idempotency key is computed over the exact bytes that go
 * on the wire.
 */
function serializePrequalifyBody(request: PrequalifyRequest, auth: AuthContext): string {
  const { applicant, coverage, products } = request;
  const payload = {
    license_key: auth.licenseKey,
    order_id: auth.orderId,
    email: auth.email,
    products: products.toWireString(),
    applicant: {
      dob: applicant.dob,
      sex: sexWireCode(applicant.sex),
      height_inches: applicant.height.totalInches,
      weight_pounds: applicant.weight.pounds,
      state: applicant.state,
      ...(applicant.zip !== undefined && { zip: applicant.zip }),
      nicotine_use: applicant.nicotineUse,
      medications: applicant.medications ?? [],
      conditions: applicant.conditions ?? [],
    },
    coverage: { type: coverage.type, amount: coverage.amount },
  };
  return JSON.stringify(payload);
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

interface RawPrequalifyPlan {
  brand?: unknown;
  tier?: unknown;
  monthly_premium?: unknown;
  face_value?: unknown;
  product_token?: unknown;
}

interface RawPrequalifyResponse {
  plans?: ReadonlyArray<RawPrequalifyPlan>;
  request_id?: unknown;
}

/** Coerce the engine's JSON response into the typed shape. */
function parsePrequalifyResponse(body: string): PrequalifyResult {
  let parsed: RawPrequalifyResponse;
  try {
    parsed = JSON.parse(body) as RawPrequalifyResponse;
  } catch (err) {
    throw new Error(`ZyIns prequalify: failed to parse response body: ${(err as Error).message}`);
  }
  const plans = Array.isArray(parsed.plans) ? parsed.plans.map(coercePlan) : [];
  const requestId = typeof parsed.request_id === 'string' ? parsed.request_id : '';
  return { plans, requestId };
}

function coercePlan(raw: RawPrequalifyPlan): PrequalifyPlan {
  return {
    brand: typeof raw.brand === 'string' ? raw.brand : '',
    tier: typeof raw.tier === 'string' ? raw.tier : '',
    monthlyPremium: typeof raw.monthly_premium === 'number' ? raw.monthly_premium : 0,
    faceValue: typeof raw.face_value === 'number' ? raw.face_value : 0,
    productToken: typeof raw.product_token === 'string' ? raw.product_token : '',
  };
}
