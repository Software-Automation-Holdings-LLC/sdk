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

import { type Applicant, NicotineUsage, type NicotineUsageInput, NicotineDuration } from './applicant.js';
import {
  type CoverageInput,
  type CoverageType,
  QuoteType,
  isMulti,
} from './coverage.js';
import { type ProductSelection, type Product, type ProductClassValue, Products } from './product.js';
import { type AuthContext } from './auth.js';
import { type Transport } from './transport.js';
import { fromHttpResponse } from './errors.js';
import { deriveIdempotencyKey } from './idempotency.js';
import { buildLicenseHMACHeaders } from '../core/index.js';
import { type Clock, systemClock } from '../core/index.js';
import { coercePlanInfo } from './planInfo.js';
import { retryAttemptsFromHeaders } from './retryAttempts.js';
import type { OfferPlanInfo, OfferPlanInfoLegacy } from './prequalify-v2-types.js';

/** Optional per-call knobs that map onto the server's filter primitives. */
export interface PrequalifyOptions {
  /** Restrict to a single product class (server `only_product_class`). */
  onlyProductClass?: ProductClassValue;
  /** Include one or more product classes (server `include_product_class`). */
  includeProductClass?: readonly ProductClassValue[];
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

/**
 * One price the server quoted for a `(rate_class, mode)` pair.
 *
 * `cents` is the server display string parsed to integer minor units (e.g.
 * `"$64.05"` → `6405`). `display` is the server string verbatim — never
 * synthesized — so consumer UIs render exactly what the carrier intended,
 * including any commas, locale formatting, or "N/A" fallbacks.
 */
export interface PriceEntry {
  /** Integer minor units. `0` for unparseable / missing / "NA" / "0" prices. */
  cents: number;
  /** Server display string verbatim. `"N/A"` when the price was missing/unparseable. */
  display: string;
}

/**
 * Resolved pricing view for a `Plan`.
 *
 * The server emits `pricing[rate_class][mode] = "$XX.XX"` plus a sibling
 * `default_pricing_key` mode and `pricing_ranks` per rate class. Rate-class
 * and mode keys are CARRIER-SPECIFIC and emerge per carrier without notice;
 * the SDK preserves them verbatim — never lowercases, aliases, or remaps.
 *
 * Resolution rules (see `resolveDefaultPricing`):
 *  1. `rate_class` = `"default"` if present, else first key of `classes` in
 *     insertion order, else `"default"` (with empty classes/modes).
 *  2. `mode` = the server's `default_pricing_key` if it exists in the chosen
 *     class; else `"MONTHLY"` if present; else first key of `classes[rate_class]`
 *     in insertion order; else `""`.
 *  3. `cents`/`display` shortcut to `classes[rate_class][mode]` for the
 *     common "show me the headline price" path.
 *  4. `modes` is an alias to `classes[rate_class]` — same object reference,
 *     not a deep copy. Mutation is undefined behavior.
 */
export interface ResolvedPricing {
  /** Shortcut to `classes[rate_class][mode].cents`. */
  cents: number;
  /** Shortcut to `classes[rate_class][mode].display`. */
  display: string;
  /** Verbatim server mode key (e.g. `"MONTHLY"`, `"MONTHLY-EFT"`). */
  mode: string;
  /** Verbatim server rate-class key (e.g. `"default"`, `"super-preferred"`). */
  rate_class: string;
  /** Server's full per-class pricing table, with `cents` parsed per mode. */
  classes: Record<string, Record<string, PriceEntry>>;
  /** Alias view of `classes[rate_class]` — same reference, not a copy. */
  modes: Record<string, PriceEntry>;
}

/** One plan returned by the engine. */
export interface Plan {
  brand: string;
  name: string;
  plan: string;
  planGroup: string | null;
  deathBenefit: number;
  /** Resolved server pricing — see `ResolvedPricing`. */
  pricing: ResolvedPricing;
  /**
   * Server's per-rate-class rank values, verbatim. Keys mirror
   * `pricing.classes`. Numeric ranks pass through; nulls pass through.
   */
  pricingRanks: Record<string, number | null>;
  /** Verbatim server `default_pricing_key`; equals `pricing.mode` post-resolution. */
  defaultPricingKey: string;
  /** Server identifier — typically the product wire token. */
  id: string;
  index: number;
  isExcluded: boolean;
  logoUrl: string;
  /**
   * Array of `{key, label, values}` items in server-canonical display order.
   * Labels are Title Case; values are URL-decoded. Iterate the array
   * directly to render the plan info section.
   *
   * The wire body may carry either the typed array (post-zyins#349) or the
   * legacy `Record<string, string[]>` map; the SDK upconverts the latter so
   * downstream consumers see exactly one shape.
   */
  planInfo: OfferPlanInfo;
  /**
   * @deprecated Removed in next major. Use `planInfo` (typed array). This
   * field mirrors the legacy map shape during the migration window.
   */
  planInfoLegacy?: OfferPlanInfoLegacy;
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
  livemode: boolean;
  retryAttempts: number;
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
  livemode: boolean;
  retryAttempts: number;
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
    return parsePrequalifyResponse(
      response.body,
      request.coverage,
      idempotencyKey,
      retryAttemptsFromHeaders(response.headers),
    );
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
  retryAttempts: number,
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
  const livemode = root['livemode'] === undefined ? true : toBool(root['livemode']);
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
    const fallbackPlans =
      byAmount.size === 1 ? byAmount.values().next().value : undefined;
    const flat: Plan[] = [];
    for (const a of amounts) {
      const list = byAmount.get(a) ?? fallbackPlans ?? [];
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
        return byAmount.get(n) ?? fallbackPlans ?? [];
      },
      meta,
      requestId,
      idempotencyKey: echoKey,
      livemode,
      retryAttempts,
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
    livemode,
    retryAttempts,
  };
}

function parseMeta(raw: unknown): PrequalifyResultMeta {
  if (!isRecord(raw)) {
    return { amounts: [], processingTimeMs: 0, quoteType: 'face_value', totalProducts: 0 };
  }
  const amountsRaw = Array.isArray(raw['amounts']) ? (raw['amounts'] as unknown[]) : [];
  const amounts = amountsRaw
    .map((v) => Number(v))
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

/**
 * Sentinel display for missing/unparseable prices.
 *
 * Carriers occasionally emit `"NA"`, `""`, `null`, `0`, or `"0"` for modes
 * they don't quote. The SDK normalizes all of these to the same `"N/A"`
 * display so consumers can render with a single conditional.
 */
const PRICE_NA_DISPLAY = 'N/A';

/**
 * Parse a server price into a `PriceEntry`.
 *
 * `cents` conversion strips `$` and `,`, then `Math.round(parseFloat(s) * 100)`.
 * Anything that doesn't parse to a finite positive (or zero) number — `"NA"`,
 * `"N/A"`, empty string, `null`, `0`, `"0"`, garbage — yields
 * `{ cents: 0, display: "N/A" }`.
 *
 * `display` preserves the server string verbatim when the price is valid
 * (commas, locale formatting, leading `$`, all kept), so consumer UIs render
 * exactly what the carrier intended.
 */
function parsePriceEntry(raw: unknown): PriceEntry {
  if (raw === null || raw === undefined) {
    return { cents: 0, display: PRICE_NA_DISPLAY };
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw === 0) {
      return { cents: 0, display: PRICE_NA_DISPLAY };
    }
    return { cents: Math.round(raw * 100), display: `$${raw.toFixed(2)}` };
  }
  if (typeof raw !== 'string') {
    return { cents: 0, display: PRICE_NA_DISPLAY };
  }
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '0' || /^na$/i.test(trimmed) || /^n\/a$/i.test(trimmed)) {
    return { cents: 0, display: PRICE_NA_DISPLAY };
  }
  const cleaned = trimmed.replace(/[$,]/g, '');
  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed === 0) {
    return { cents: 0, display: PRICE_NA_DISPLAY };
  }
  return { cents: Math.round(parsed * 100), display: trimmed };
}

/**
 * Build the `classes` map by parsing every `pricing[class][mode]` entry.
 *
 * Insertion order is preserved (V8 / spec object iteration is insertion-order
 * for string keys), which matters: the resolver falls back to "first key in
 * insertion order" when no preferred key is present.
 */
function buildClasses(
  pricingRaw: Record<string, unknown>,
): Record<string, Record<string, PriceEntry>> {
  const classes: Record<string, Record<string, PriceEntry>> = {};
  for (const [className, modesRaw] of Object.entries(pricingRaw)) {
    if (!isRecord(modesRaw)) continue;
    const modes: Record<string, PriceEntry> = {};
    for (const [modeName, priceRaw] of Object.entries(modesRaw)) {
      modes[modeName] = parsePriceEntry(priceRaw);
    }
    classes[className] = modes;
  }
  return classes;
}

/** Default rate-class key used when neither server nor classes can supply one. */
const DEFAULT_RATE_CLASS = 'default';
/** Preferred mode fallback when no `default_pricing_key` is present. */
const FALLBACK_MODE = 'MONTHLY';

/**
 * Apply the resolution rules from the spec:
 *  - rate_class: prefer `"default"` → first-class-in-order → `"default"` empty.
 *  - mode: prefer server's `default_pricing_key` → `"MONTHLY"` → first-mode-in-order → `""`.
 *  - cents/display: shortcut to the chosen `classes[rate_class][mode]`.
 *  - modes: alias (same reference) to `classes[rate_class]`.
 */
function resolveDefaultPricing(
  classes: Record<string, Record<string, PriceEntry>>,
  serverDefaultKey: string,
): ResolvedPricing {
  const classNames = Object.keys(classes);
  if (classNames.length === 0) {
    return {
      cents: 0,
      display: PRICE_NA_DISPLAY,
      mode: '',
      rate_class: DEFAULT_RATE_CLASS,
      classes,
      modes: {},
    };
  }
  const rate_class =
    DEFAULT_RATE_CLASS in classes ? DEFAULT_RATE_CLASS : (classNames[0] as string);
  const modes = classes[rate_class] as Record<string, PriceEntry>;
  const modeNames = Object.keys(modes);
  let mode: string;
  if (serverDefaultKey !== '' && serverDefaultKey in modes) {
    mode = serverDefaultKey;
  } else if (FALLBACK_MODE in modes) {
    mode = FALLBACK_MODE;
  } else if (modeNames.length > 0) {
    mode = modeNames[0] as string;
  } else {
    mode = '';
  }
  const entry = mode === '' ? undefined : modes[mode];
  return {
    cents: entry?.cents ?? 0,
    display: entry?.display ?? PRICE_NA_DISPLAY,
    mode,
    rate_class,
    classes,
    modes,
  };
}

/** Pass through `pricing_ranks` verbatim — numbers stay numbers, nulls stay null. */
function parsePricingRanks(raw: unknown): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  if (!isRecord(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === undefined) {
      out[k] = null;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v;
    } else if (typeof v === 'string') {
      const n = Number(v);
      out[k] = Number.isFinite(n) ? n : null;
    } else {
      out[k] = null;
    }
  }
  return out;
}

function coercePlan(raw: unknown): Plan {
  const r = isRecord(raw) ? raw : {};
  const id = toStr(r['id']);
  const planInfoCoerced = coercePlanInfo(r['plan_info']);
  const pricingRaw = isRecord(r['pricing']) ? (r['pricing'] as Record<string, unknown>) : {};
  const classes = buildClasses(pricingRaw);
  const serverDefaultKey = toStr(r['default_pricing_key']);
  const pricing = resolveDefaultPricing(classes, serverDefaultKey);
  const pricingRanks = parsePricingRanks(r['pricing_ranks']);
  const plan: Plan = {
    brand: toStr(r['brand']),
    name: toStr(r['name']),
    plan: toStr(r['plan']),
    planGroup: typeof r['plan_group'] === 'string' ? toStr(r['plan_group']) : null,
    deathBenefit: toNum(r['death_benefit']),
    pricing,
    pricingRanks,
    defaultPricingKey: pricing.mode,
    id,
    index: toNum(r['index']),
    isExcluded: toBool(r['is_excluded']),
    logoUrl: toStr(r['logo_url']),
    planInfo: planInfoCoerced.array,
    planInfoLegacy: planInfoCoerced.legacy,
    raw: r,
  };
  const hydrated = id ? Products.byWireToken(id) : undefined;
  if (hydrated) plan.product = hydrated;
  return plan;
}

