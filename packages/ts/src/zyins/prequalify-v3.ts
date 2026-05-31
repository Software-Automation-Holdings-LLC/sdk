/**
 * Tier 3 prequalify v3 operation — `POST /v3/prequalify`.
 *
 * The v3 contract collapses v2's `premium` + `other_offers` into one
 * uniform `pricing[]` table per product (see `prequalify-v3-types.ts`).
 * Money is integer cents + server-formatted `display`; array order is
 * authoritative; there is no `result_index`.
 *
 * Idempotency: every v3 mutating call requires a UUID v4 in
 * `Idempotency-Key`. We auto-mint when the caller does not supply one.
 */

import {
  type Applicant,
  type Condition,
  type Medication,
  NicotineUsage,
  type NicotineProductUsage,
  type NicotineUsageInput,
  NicotineDuration,
} from './applicant.js';
import { type CoverageInput, QuoteType, isMulti } from './coverage.js';
import { fromHttpResponse } from './errors.js';
import { buildLicenseHMACHeaders } from '../core/index.js';
import { type AuthContext } from './auth.js';
import { type Clock, systemClock } from '../core/index.js';
import { retryAttemptsFromHeaders } from './retryAttempts.js';
import { coercePlanInfo } from './planInfo.js';
import {
  coerceAmount,
  coerceCarrier,
  coerceMoney,
  coerceProduct,
  isRecord,
  toBool,
  toNullableNum,
  toNum,
  toStr,
} from './v3Coercion.js';
import {
  type PrequalifyV3Context,
  type PrequalifyV3Request,
  type PrequalifyV3Result,
  type V3Amount,
  type V3Eligibility,
  type V3EligibilityCategory,
  type V3Offer,
  type V3Premium,
  type V3PricingRow,
} from './prequalify-v3-types.js';

export { byAmount, offerPremium } from './prequalify-v3-types.js';
export type {
  PrequalifyV3Context,
  PrequalifyV3Options,
  PrequalifyV3Request,
  PrequalifyV3Result,
  QuoteV3Context,
  QuoteV3Options,
  QuoteV3Request,
  QuoteV3Result,
  V3Amount,
  V3Eligibility,
  V3EligibilityCategory,
  V3Money,
  V3Offer,
  V3Period,
  V3Premium,
  V3PricingRow,
} from './prequalify-v3-types.js';

const PREQUALIFY_V3_PATH = '/v3/prequalify';

/**
 * Run a v3 prequalify call. Builds the wire body, mints a UUID v4 for
 * `Idempotency-Key` if the caller did not pass one, signs the request,
 * and parses the envelope into typed offers.
 */
export async function prequalifyV3(
  request: PrequalifyV3Request,
  ctx: PrequalifyV3Context,
): Promise<PrequalifyV3Result> {
  const body = serializeV3PrequalifyBody(request);
  const idempotencyKey = ctx.idempotencyKey ?? mintUuidV4();
  const headers = await buildHeaders({
    auth: ctx.auth,
    body,
    idempotencyKey,
    clock: ctx.clock,
    path: PREQUALIFY_V3_PATH,
    apiVersion: 'v3',
  });
  const url = `${ctx.baseUrl}${PREQUALIFY_V3_PATH}`;
  const response = await ctx.transport({ url, method: 'POST', headers, body });
  if (response.status >= 200 && response.status < 300) {
    return parsePrequalifyEnvelope(
      response.body,
      idempotencyKey,
      retryAttemptsFromHeaders(response.headers),
    );
  }
  throw fromHttpResponse(response.status, response.body);
}

// ---------------------------------------------------------------------------
// Wire body serialization — v3 prequalify envelope shape.
//
// `POST /v3/prequalify` accepts the envelope `PrequalifyV3Request` schema
// (`applicant` + `coverage` + `products[]`) — NOT the v2 flat shape that
// `/v3/quote` still consumes via `serializeWireBody` below. Emitting the
// v2 flat shape against `/v3/prequalify` produces `unknown field
// "date_of_birth"` from the zyins server (prod incident, 2026-05-29).
//
// See `PrequalifyV3Request` / `ApplicantV3Input` / `CoverageV3Input` /
// `NicotineUsageInput` in `go/zyins/api/openapi.yaml` (canonical source).
// ---------------------------------------------------------------------------

/**
 * v3 nicotine frequency enum the server accepts (`NicotineFrequencyV3`).
 * The Tier 3 SDK currently surfaces v2-grade strings on
 * `NicotineProductUsage.frequency` (e.g. `DAILY`, `WEEKLY`); we coerce
 * here so v3 callers do not need to know the wire enum names.
 */
const V3_NICOTINE_FREQUENCY: Record<string, string> = {
  daily: 'daily',
  DAILY: 'daily',
  weekly: 'few_times_per_week',
  WEEKLY: 'few_times_per_week',
  few_times_per_week: 'few_times_per_week',
  monthly: 'few_times_per_month',
  MONTHLY: 'few_times_per_month',
  few_times_per_month: 'few_times_per_month',
  yearly: 'few_times_per_year',
  YEARLY: 'few_times_per_year',
  few_times_per_year: 'few_times_per_year',
};

/** Cents per dollar. The v3 coverage envelope speaks integer cents. */
const CENTS_PER_DOLLAR = 100;

function dollarsToCents(amount: number): number {
  return Math.round(amount * CENTS_PER_DOLLAR);
}

/**
 * Serialize a {@link Condition} into the v3 `ConditionV3Input` wire shape.
 * SDK condition rows carry a freeform `name`; v3 accepts that as `text`
 * (with optional opaque catalog `id` from `GET /v3/datasets`). Date fields
 * pass through verbatim — the engine accepts ISO 8601, US format, and
 * relative phrases.
 */
function serializeV3Condition(c: Condition): Record<string, unknown> {
  const row: Record<string, unknown> = { text: c.name };
  if (c.wasDiagnosed !== undefined && c.wasDiagnosed !== '') {
    row['was_diagnosed'] = c.wasDiagnosed;
  }
  if (c.lastTreatment !== undefined && c.lastTreatment !== '') {
    row['last_treatment'] = c.lastTreatment;
  }
  return row;
}

/**
 * Serialize a {@link Medication} into the v3 `MedicationV3Input` wire
 * shape. SDK medications carry freeform `name`; v3 accepts that as
 * `text`. `use`, `firstFill`, `lastFill` map to `use`, `first_fill`,
 * `last_fill` respectively.
 */
function serializeV3Medication(m: Medication): Record<string, unknown> {
  const row: Record<string, unknown> = { text: m.name };
  if (m.use !== undefined && m.use !== '') row['use'] = m.use;
  if (m.firstFill !== undefined && m.firstFill !== '') row['first_fill'] = m.firstFill;
  if (m.lastFill !== undefined && m.lastFill !== '') row['last_fill'] = m.lastFill;
  return row;
}

/**
 * Serialize one {@link NicotineProductUsage} into the v3
 * `NicotineSpecificityInput` shape. The v2 SDK calls the freeform name
 * `type`; v3 calls it `text`. Frequency is mapped through
 * {@link V3_NICOTINE_FREQUENCY} so v2-grade strings (`DAILY`, `WEEKLY`)
 * become valid v3 enum values (`daily`, `few_times_per_week`).
 */
function serializeV3NicotineSpecificity(p: NicotineProductUsage): Record<string, unknown> {
  const frequency = V3_NICOTINE_FREQUENCY[p.frequency];
  if (frequency === undefined) {
    // Underwriting input: an unrecognized frequency must fail loudly.
    // Silently coercing it (the old behavior defaulted to 'daily') would
    // mis-price a smoker whose true frequency the caller mistyped.
    const allowed = [...new Set(Object.values(V3_NICOTINE_FREQUENCY))].join(', ');
    throw new Error(
      `Unknown nicotine frequency ${JSON.stringify(p.frequency)} for "${p.type}"; expected one of: ${allowed}`,
    );
  }
  return { text: p.type, frequency };
}

/**
 * Serialize `applicant.nicotineUse` into the v3 `NicotineUsageInput`
 * envelope. Per the OpenAPI schema: `{ last_used, specificity[] }`. The
 * deprecated legacy {@link NicotineUsage} three-state enum widens to
 * `Never` / `Within12Months` / `12_to_24_months` per the existing v2
 * compatibility mapping.
 */
function serializeV3Nicotine(
  nicotineUse: Applicant['nicotineUse'],
): { last_used: string; specificity?: Array<Record<string, unknown>> } {
  if (typeof nicotineUse === 'object' && nicotineUse !== null) {
    const input = nicotineUse as NicotineUsageInput;
    const result: { last_used: string; specificity?: Array<Record<string, unknown>> } = {
      last_used: input.lastUsed as string,
    };
    if (input.productUsage !== undefined && input.productUsage.length > 0) {
      result.specificity = input.productUsage.map(serializeV3NicotineSpecificity);
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

/**
 * Build the v3 `coverage` envelope from the input discriminator.
 *
 * Single amount keeps the proven `{ face_amount_cents }` wire shape
 * (integer cents, SDK dollars × 100 rounded). Multi-amount mirrors the
 * `/v3/quote` `quote_options` block — `{ quote_type, amounts: string[] }`
 * — so the server's additive `face_amount_cents` XOR `quote_options`
 * contract (zyins #400) is satisfied with one serializer per shape.
 * `state` and `zip` are carried on the envelope per the v3 schema in
 * both cases. `zip` is omitted when the caller supplied none — the
 * server pattern `^\d{5}(-\d{4})?$` rejects an empty string, and zip is
 * required only for medsup quotes.
 */
function serializeV3Coverage(
  coverage: PrequalifyV3Request['coverage'],
  state: string,
  zip: string | null | undefined,
): Record<string, unknown> {
  const locale: Record<string, unknown> = { state };
  // `!= null` excludes both null and undefined; the empty-string check keeps a
  // blank zip off the wire (server pattern `^\d{5}(-\d{4})?$` rejects "").
  if (zip != null && zip !== '') {
    locale['zip'] = zip;
  }
  if (isMulti(coverage)) {
    return {
      quote_options: {
        quote_type:
          coverage.type === 'face_value' ? QuoteType.FaceAmounts : QuoteType.MonthlyBudget,
        amounts: coverage.amounts.map((n) => String(n)),
      },
      ...locale,
    };
  }
  // A single monthly budget has no face_amount_cents to express, so it
  // rides the quote_options block with one amount and the monthly_budget
  // discriminator — the same path the server (zyins #400) accepts for the
  // multi-amount budget probe. A single face amount keeps the proven
  // face_amount_cents wire shape.
  if (coverage.type !== 'face_value') {
    return {
      quote_options: {
        quote_type: QuoteType.MonthlyBudget,
        amounts: [String(coverage.amount)],
      },
      ...locale,
    };
  }
  return {
    face_amount_cents: dollarsToCents(coverage.amount),
    ...locale,
  };
}

/**
 * Build the `PrequalifyV3Request` wire body — the envelope shape with
 * `applicant`, `coverage`, `products[]` per the OpenAPI spec.
 *
 * Coverage serialization is shape-driven (see {@link serializeV3Coverage}):
 * a single face amount sends `coverage.face_amount_cents`; a multi-amount
 * probe sends `coverage.quote_options`. The server (zyins #400) answers
 * the former with flat `plans` and the latter with grouped `results`.
 *
 * `applicant.state` and `applicant.zip` are moved into the coverage
 * envelope per the v3 schema (`zip` is required for medsup quotes; the
 * server zip-gates and silently filters medsup products when it is
 * absent). `options.minRank`, `options.showUnreleased`,
 * `options.skipHealthBasedUnderwriting`, `options.onlyProductClass`,
 * `options.includeProductClass` are not part of the v3 prequalify
 * envelope and are silently dropped — they survive on `/v3/quote` via
 * the legacy flat body.
 */
export function serializeV3PrequalifyBody(request: PrequalifyV3Request): string {
  const { applicant, coverage, products, options } = request;
  const productsWire = products.toWireFields();
  // The v3 prequalify envelope carries only explicit product slugs. A
  // type-based selection (ProductSelection.byTypes / fromMix with types)
  // serializes an include_product_class field that the v3 envelope has
  // no place for, so reject it loudly instead of silently sending
  // products: [] and underwriting the wrong set. Detecting it from the
  // wire fields (rather than a ProductSelection method) keeps the check
  // robust to any toWireFields-shaped products value. Type-based
  // selection is supported on the v2 prequalify / v3 quote flat body.
  if (
    Array.isArray(productsWire['include_product_class']) &&
    productsWire['include_product_class'].length > 0
  ) {
    throw new Error(
      'ProductSelection.byTypes is not supported on v3 prequalify; the v3 envelope accepts explicit products only. Use ProductSelection.of(...) here, or pin apiVersion { prequalify: "v2" } to select by product class.',
    );
  }
  const productsList = Array.isArray(productsWire['products'])
    ? (productsWire['products'] as readonly unknown[]).map((p) => String(p))
    : [];
  const applicantWire: Record<string, unknown> = {
    sex: applicant.sex as string,
    dob: applicant.dob,
    height_inches: applicant.height.totalInches,
    weight_lbs: applicant.weight.pounds,
    nicotine: serializeV3Nicotine(applicant.nicotineUse),
  };
  if (applicant.conditions !== undefined && applicant.conditions.length > 0) {
    applicantWire['conditions'] = applicant.conditions.map(serializeV3Condition);
  }
  if (applicant.medications !== undefined && applicant.medications.length > 0) {
    applicantWire['medications'] = applicant.medications.map(serializeV3Medication);
  }
  const payload: Record<string, unknown> = {
    applicant: applicantWire,
    coverage: serializeV3Coverage(coverage, applicant.state, applicant.zip),
    products: productsList,
  };
  if (options?.includeIneligible !== undefined) {
    payload['include_ineligible'] = options.includeIneligible;
  } else {
    payload['include_ineligible'] = true;
  }
  return JSON.stringify(payload);
}

// ---------------------------------------------------------------------------
// Wire body serialization — v3 quote (legacy flat shape).
//
// `POST /v3/quote` currently consumes the v2 `QuoteRequest` flat body
// (see `openapi.yaml` operation `quoteV3`). Kept here as the shared
// serializer until `/v3/quote` is migrated to its own envelope.
// ---------------------------------------------------------------------------

export function serializeWireBody(request: {
  readonly applicant: Applicant;
  readonly coverage: CoverageInput;
  readonly products: PrequalifyV3Request['products'];
  readonly options?: PrequalifyV3Request['options'];
}): string {
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
      const fromSelection = payload['include_product_class'] as string[] | undefined;
      const extra = options.includeProductClass.map((t) => t.wireToken);
      payload['include_product_class'] = [...new Set([...(fromSelection ?? []), ...extra])];
    }
    if (options.minRank !== undefined) payload['min_rank'] = options.minRank;
    if (options.showUnreleased !== undefined) payload['show_unreleased'] = options.showUnreleased;
    if (options.skipHealthBasedUnderwriting !== undefined) {
      payload['skip_health_based_underwriting'] = options.skipHealthBasedUnderwriting;
    }
    if (options.includeIneligible !== undefined) {
      payload['include_ineligible'] = options.includeIneligible;
    }
  }
  if (payload['include_ineligible'] === undefined) {
    payload['include_ineligible'] = true;
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

export async function buildHeaders(args: {
  readonly auth: AuthContext;
  readonly body: string;
  readonly idempotencyKey: string;
  readonly clock: Clock;
  readonly path: string;
  /**
   * Pinned API version for this call. When set, surfaces as the
   * `Api-Version` request header so the server routes deterministically
   * even if a transport-layer middleware mutates the URL.
   */
  readonly apiVersion?: string;
}): Promise<Record<string, string>> {
  const licenseHeaders = await buildLicenseHMACHeaders(
    args.auth.licenseKey,
    args.auth.orderId,
    args.auth.email,
    'POST',
    args.path,
    args.body,
    args.auth.deviceId,
    args.clock ?? systemClock,
  );
  const headers: Record<string, string> = {
    ...licenseHeaders,
    'Content-Type': 'application/json',
    'Idempotency-Key': args.idempotencyKey,
  };
  if (args.apiVersion !== undefined && args.apiVersion !== '') {
    headers['Api-Version'] = args.apiVersion;
  }
  return headers;
}

// ---------------------------------------------------------------------------
// UUID v4 minting (no external deps). Cryptographically random when the
// runtime exposes `crypto.getRandomValues`; falls back to `Math.random`
// otherwise so test environments without WebCrypto still mint a value.
// ---------------------------------------------------------------------------

export function mintUuidV4(): string {
  const bytes = new Uint8Array(16);
  const cryptoApi: { getRandomValues?: (a: Uint8Array) => Uint8Array } | undefined =
    typeof globalThis !== 'undefined'
      ? (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto
      : undefined;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // Version + variant bits per RFC 4122.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    hex.push((bytes[i] ?? 0).toString(16).padStart(2, '0'));
  }
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}

// ---------------------------------------------------------------------------
// Response parsing.
// ---------------------------------------------------------------------------

function parsePrequalifyEnvelope(
  body: string,
  idempotencyKey: string,
  retryAttempts: number,
): PrequalifyV3Result {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    throw new Error(
      `ZyIns prequalifyV3: failed to parse response body: ${(err as Error).message}`,
    );
  }
  const root = isRecord(parsed) ? parsed : {};
  const requestId = toStr(root['request_id']);
  const echoKey = toStr(root['idempotency_key']) || idempotencyKey;
  const livemode = root['livemode'] === undefined ? true : toBool(root['livemode']);
  const data = isRecord(root['data']) ? (root['data'] as Record<string, unknown>) : {};
  // The v3 response is always a flat `plans[]` array — single amount and
  // multi-amount alike. Group client-side with `byAmount` on the requested
  // dimension (deathBenefit for face amounts, budget for monthly budgets).
  // Absent plans (vs present-but-empty) indicates wire-shape drift; fail fast.
  if (!('plans' in data)) {
    throw new Error('ZyIns prequalifyV3: missing plans field in v3 response');
  }
  const plansRaw = Array.isArray(data['plans']) ? (data['plans'] as unknown[]) : [];
  const plans = plansRaw.map(coerceV3Offer);
  return {
    plans,
    requestId,
    idempotencyKey: echoKey,
    livemode,
    retryAttempts,
  };
}

function coerceEligibility(raw: unknown): V3Eligibility {
  const r = isRecord(raw) ? raw : {};
  const categoryRaw = r['category'];
  const category: V3EligibilityCategory =
    categoryRaw === 'immediate' ||
    categoryRaw === 'graded' ||
    categoryRaw === 'rop' ||
    categoryRaw === 'other'
      ? categoryRaw
      : null;
  const reasonsRaw = Array.isArray(r['reasons']) ? (r['reasons'] as unknown[]) : [];
  return {
    category,
    eligible: toBool(r['eligible']),
    reasons: reasonsRaw.map((x) => toStr(x)),
  };
}

function coercePremium(raw: unknown): V3Premium | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (!isRecord(raw)) return undefined;
  const modesRaw = isRecord(raw['modes']) ? (raw['modes'] as Record<string, unknown>) : {};
  const modes: Record<string, V3Amount> = {};
  for (const [k, v] of Object.entries(modesRaw)) {
    modes[k] = coerceAmount(v);
  }
  const defaultMode = toStr(raw['default_mode']);
  // `amount` is byte-identical to `modes[default_mode]`; read it from the wire
  // `amount` when present, else fall back to the mode grid so a server that
  // only populated `modes` still yields the headline value.
  const amount =
    raw['amount'] !== undefined
      ? coerceAmount(raw['amount'])
      : (modes[defaultMode] ?? coerceAmount(undefined));
  return { amount, defaultMode, modes };
}

export function coercePricingRow(raw: unknown): V3PricingRow {
  const r = isRecord(raw) ? raw : {};
  const premium = coercePremium(r['premium']);
  const base: V3PricingRow = {
    rateClass: toStr(r['rate_class']),
    primary: toBool(r['primary']),
    eligibility: coerceEligibility(r['eligibility']),
    rank: toNullableNum(r['rank']),
    ...(premium === undefined ? {} : { premium }),
  };
  return base;
}

/**
 * Coerce one flat `plans[]` entry. Shared by `prequalifyV3` and `quoteV3`
 * — both endpoints return the identical {@link V3Offer} shape. `budget` is
 * present only on monthly-budget responses (`undefined` otherwise).
 */
export function coerceV3Offer(raw: unknown): V3Offer {
  const r = isRecord(raw) ? raw : {};
  const pricingRaw = Array.isArray(r['pricing']) ? (r['pricing'] as unknown[]) : [];
  const metadata = isRecord(r['metadata']) ? (r['metadata'] as Record<string, unknown>) : {};
  const planInfo = coercePlanInfo(r['plan_info']);
  // death_benefit is null on the wire for premium-only products (medsup);
  // a Money object for life products. Preserve the null rather than coercing
  // it into a zero-cents Money, so consumers null-check medsup correctly.
  const deathBenefit = isRecord(r['death_benefit']) ? coerceMoney(r['death_benefit']) : null;
  const base: V3Offer = {
    object: 'plan_offer',
    id: toStr(r['id']),
    eligible: toBool(r['eligible']),
    carrier: coerceCarrier(r['carrier']),
    product: coerceProduct(r['product']),
    planInfo: planInfo.array,
    deathBenefit,
    pricing: pricingRaw.map(coercePricingRow),
    metadata,
    ...(isRecord(r['budget']) ? { budget: coerceMoney(r['budget']) } : {}),
  };
  return base;
}
