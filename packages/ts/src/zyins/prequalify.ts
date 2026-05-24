/**
 * Tier 3 prequalify operation.
 *
 * Builds the wire body, signs the request, calls `/v1/prequalify`, and
 * parses the response into one of two result shapes:
 *   - `SinglePrequalifyResult` — single coverage amount.
 *   - `MultiPrequalifyResult` — multiple amounts probed together.
 *
 * Locked invariants (per ADR-035, post-lock v0.5.3 spec):
 *  - The wire body is built by the SDK; the call site never sees it.
 *  - The idempotency key is derived from sessionId:op:body-hash.
 *  - Auth credentials live in HMAC headers only — never in the request body.
 *  - `products` accepts only typed wire tokens — regex semantics are gone.
 *  - Server response shape is `{ data: { meta, results: { <amount>: [...] } },
 *    request_id, idempotency_key }`.
 */

import { type Applicant, NicotineUsage, type NicotineUsageInput, NicotineDuration } from './applicant';
import {
  type CoverageInput,
  type CoverageType,
  QuoteType,
  isMulti,
} from './coverage';
import { type ProductSelection, type Product, type ProductTypeValue, Products } from './product';
import { type AuthContext } from './auth';
import { type Transport } from './transport';
import { fromHttpResponse } from './errors';
import { deriveIdempotencyKey } from './idempotency';
import { buildLicenseHMACHeaders } from '../core';
import { type Clock, systemClock } from '../core';

/** Optional per-call knobs that map onto the server's filter primitives. */
export interface PrequalifyOptions {
  /** Restrict to a single product class (server `only_product_class`). */
  onlyProductClass?: ProductTypeValue;
  /** Include one or more product classes (server `include_product_class`). */
  includeProductClass?: readonly ProductTypeValue[];
  /** Server-side `min_rank` filter (string per server contract). */
  minRank?: string;
  /** Include products flagged unreleased. */
  showUnreleased?: boolean;
  /** Skip the health-based underwriting layer (preview rates without HBU). */
  skipHealthBasedUnderwriting?: boolean;
}

/** Inputs accepted by `prequalify`. */
export interface PrequalifyRequest {
  applicant: Applicant;
  coverage: CoverageInput;
  products: ProductSelection;
  options?: PrequalifyOptions;
}

/** One plan returned by the engine. */
export interface Plan {
  brand: string;
  name: string;
  plan: string;
  planGroup: string | null;
  deathBenefit: number;
  monthlyPrice: number | undefined;
  defaultPricingKey: string;
  /** Server identifier — typically the product wire token. */
  id: string;
  index: number;
  isExcluded: boolean;
  logoUrl: string;
  planInfo: Record<string, readonly string[]>;
  pricing: Record<string, { monthly: number; [k: string]: unknown }>;
  /** Hydrated typed catalog product when `id` matches a known wire token. */
  product?: Product;
  /** Forward-compatible raw fields the server emits but we don't yet model. */
  raw: Record<string, unknown>;
}

/** Backwards-compat alias — older call sites used `PrequalifyPlan`. */
export type PrequalifyPlan = Plan;

/** Aggregate meta from `data.meta`. */
export interface PrequalifyResultMeta {
  amounts: number[];
  processingTimeMs: number;
  quoteType: CoverageType;
  totalProducts: number;
}

/** Result shape for a single-amount prequalify call. */
export interface SinglePrequalifyResult {
  readonly kind: 'single';
  amount: number;
  plans: Plan[];
  meta: PrequalifyResultMeta;
  requestId: string;
  idempotencyKey: string;
}

/** Result shape for a multi-amount prequalify call. */
export interface MultiPrequalifyResult {
  readonly kind: 'multi';
  amounts: number[];
  byAmount: Map<number, Plan[]>;
  /** Flattened convenience — every plan across every amount. */
  plans: Plan[];
  forAmount(n: number): Plan[];
  meta: PrequalifyResultMeta;
  requestId: string;
  idempotencyKey: string;
}

/** Union returned by `prequalify`. */
export type PrequalifyResult = SinglePrequalifyResult | MultiPrequalifyResult;

/** Shared knobs the client passes through to the prequalify call. */
export interface PrequalifyContext {
  baseUrl: string;
  auth: AuthContext;
  transport: Transport;
  clock: Clock;
  /** Optional override; defaults to the derived key. */
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
  return executePrequalify(body, request, ctx);
}

async function executePrequalify(
  body: string,
  request: PrequalifyRequest,
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
    return parsePrequalifyResponse(response.body, request.coverage, idempotencyKey);
  }
  throw fromHttpResponse(response.status, response.body);
}

/**
 * Serialize the prequalify request to the wire body. Auth credentials
 * belong in HMAC headers (built separately) — they MUST NOT appear here.
 */
function serializeWireBody(request: PrequalifyRequest): string {
  const { applicant, coverage, products, options } = request;
  const payload: Record<string, unknown> = {
    date_of_birth: applicant.dob,
    gender: applicant.sex as string,
    height: applicant.height.totalInches,
    weight: applicant.weight.pounds,
    state: applicant.state,
    nicotine_usage: serializeNicotineUsage(applicant.nicotineUse),
    conditions: applicant.conditions ?? [],
    medications: applicant.medications ?? [],
    quote_options: {
      quote_type: coverage.type === 'face_value' ? QuoteType.FaceAmounts : QuoteType.MonthlyBudget,
      amounts: extractAmounts(coverage).map((n) => String(n)),
    },
    ...products.toWireFields(),
  };
  if (applicant.zip !== undefined) {
    payload['zip'] = applicant.zip;
  }
  if (options) {
    if (options.onlyProductClass !== undefined) {
      payload['only_product_class'] = options.onlyProductClass.wireToken;
    }
    if (options.includeProductClass !== undefined && options.includeProductClass.length > 0) {
      // Merge with ProductSelection-emitted include_product_class.
      const fromSelection = payload['include_product_class'] as string[] | undefined;
      const extra = options.includeProductClass.map((t) => t.wireToken);
      payload['include_product_class'] = [...new Set([...(fromSelection ?? []), ...extra])];
    }
    if (options.minRank !== undefined) payload['min_rank'] = options.minRank;
    if (options.showUnreleased !== undefined) payload['show_unreleased'] = options.showUnreleased;
    if (options.skipHealthBasedUnderwriting !== undefined) {
      payload['skip_health_based_underwriting'] = options.skipHealthBasedUnderwriting;
    }
  }
  return JSON.stringify(payload);
}

function extractAmounts(coverage: CoverageInput): readonly number[] {
  return isMulti(coverage) ? coverage.amounts : [coverage.amount];
}

function serializeNicotineUsage(
  nicotineUse: Applicant['nicotineUse'],
): { last_used: string; product_usage?: Array<{ type: string; frequency: string }> } {
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

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

const toStr = (v: unknown): string => (typeof v === 'string' ? v : '');
const toNum = (v: unknown): number => (typeof v === 'number' ? v : 0);
const toBool = (v: unknown): boolean => v === true;

/**
 * Parse the server response into either `SinglePrequalifyResult` or
 * `MultiPrequalifyResult` based on the requested coverage shape.
 *
 * Wire body shape (verified live):
 * ```
 * { data: { meta: {amounts, processing_time_ms, quote_type, total_products},
 *           results: { "<amount>": [<rawPlan>, ...] } },
 *   request_id, idempotency_key }
 * ```
 */
function parsePrequalifyResponse(
  body: string,
  coverage: CoverageInput,
  idempotencyKey: string,
): PrequalifyResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    throw new Error(
      `ZyIns prequalify: failed to parse response body: ${(err as Error).message}`,
    );
  }
  const root = isRecord(parsed) ? parsed : {};
  const requestId = toStr(root['request_id']);
  const echoKey = toStr(root['idempotency_key']) || idempotencyKey;
  const data = isRecord(root['data']) ? (root['data'] as Record<string, unknown>) : {};
  const meta = parseMeta(data['meta']);
  const results = isRecord(data['results']) ? (data['results'] as Record<string, unknown>) : {};

  const byAmount = new Map<number, Plan[]>();
  for (const [amtKey, plansRaw] of Object.entries(results)) {
    const amt = Number(amtKey);
    if (!Number.isFinite(amt)) continue;
    const list = Array.isArray(plansRaw) ? plansRaw.map(coercePlan) : [];
    byAmount.set(amt, list);
  }

  if (isMulti(coverage)) {
    const amounts = coverage.amounts.slice().map((n) => Math.round(n));
    const flat: Plan[] = [];
    for (const a of amounts) {
      const list = byAmount.get(a) ?? [];
      for (const p of list) flat.push(p);
    }
    return {
      kind: 'multi',
      amounts,
      byAmount,
      plans: flat,
      forAmount(n: number): Plan[] {
        if (!amounts.includes(n)) {
          throw new Error(
            `MultiPrequalifyResult.forAmount: amount ${n} not requested; available: ${amounts.join(', ')}`,
          );
        }
        return byAmount.get(n) ?? [];
      },
      meta,
      requestId,
      idempotencyKey: echoKey,
    };
  }

  const amount = Math.round(coverage.amount);
  // Try the requested amount first; fall back to the only entry if results
  // came back with a single mismatched key (e.g. the server rounded).
  let plans = byAmount.get(amount);
  if (!plans && byAmount.size === 1) {
    plans = byAmount.values().next().value;
  }
  return {
    kind: 'single',
    amount,
    plans: plans ?? [],
    meta,
    requestId,
    idempotencyKey: echoKey,
  };
}

function parseMeta(raw: unknown): PrequalifyResultMeta {
  if (!isRecord(raw)) {
    return { amounts: [], processingTimeMs: 0, quoteType: 'face_value', totalProducts: 0 };
  }
  const amountsRaw = Array.isArray(raw['amounts']) ? (raw['amounts'] as unknown[]) : [];
  const amounts = amountsRaw
    .map((v) => Number(typeof v === 'string' ? v : v))
    .filter((n) => Number.isFinite(n));
  const quoteTypeRaw = toStr(raw['quote_type']);
  const quoteType: CoverageType =
    quoteTypeRaw === 'monthly_budget' ? 'monthly_budget' : 'face_value';
  return {
    amounts,
    processingTimeMs: toNum(raw['processing_time_ms']),
    quoteType,
    totalProducts: toNum(raw['total_products']),
  };
}

function coercePlan(raw: unknown): Plan {
  const r = isRecord(raw) ? raw : {};
  const id = toStr(r['id']);
  const monthlyPriceRaw = r['monthly_price'];
  let monthlyPrice: number | undefined;
  if (typeof monthlyPriceRaw === 'number') {
    monthlyPrice = monthlyPriceRaw;
  } else if (typeof monthlyPriceRaw === 'string') {
    const cleaned = monthlyPriceRaw.replace(/[^0-9.]/g, '');
    monthlyPrice = cleaned === '' ? undefined : Number(cleaned);
  }
  const planInfoRaw = isRecord(r['plan_info']) ? (r['plan_info'] as Record<string, unknown>) : {};
  const planInfo: Record<string, readonly string[]> = {};
  for (const [k, v] of Object.entries(planInfoRaw)) {
    planInfo[k] = Array.isArray(v) ? (v as unknown[]).map((x) => toStr(x)) : [];
  }
  const pricingRaw = isRecord(r['pricing']) ? (r['pricing'] as Record<string, unknown>) : {};
  const pricing: Record<string, { monthly: number; [k: string]: unknown }> = {};
  for (const [k, v] of Object.entries(pricingRaw)) {
    if (isRecord(v)) {
      pricing[k] = { ...v, monthly: toNum((v as Record<string, unknown>)['monthly']) };
    }
  }
  const plan: Plan = {
    brand: toStr(r['brand']),
    name: toStr(r['name']),
    plan: toStr(r['plan']),
    planGroup: typeof r['plan_group'] === 'string' ? toStr(r['plan_group']) : null,
    deathBenefit: toNum(r['death_benefit']),
    monthlyPrice,
    defaultPricingKey: toStr(r['default_pricing_key']),
    id,
    index: toNum(r['index']),
    isExcluded: toBool(r['is_excluded']),
    logoUrl: toStr(r['logo_url']),
    planInfo,
    pricing,
    raw: r,
  };
  const hydrated = id ? Products.byWireToken(id) : undefined;
  if (hydrated) plan.product = hydrated;
  return plan;
}
