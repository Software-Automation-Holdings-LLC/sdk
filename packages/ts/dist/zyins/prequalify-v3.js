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
import { NicotineUsage, NicotineDuration, } from './applicant.js';
import { QuoteType, isMulti } from './coverage.js';
import { fromHttpResponse } from './errors.js';
import { buildLicenseHMACHeaders } from '../core/index.js';
import { systemClock } from '../core/index.js';
import { retryAttemptsFromHeaders } from './retryAttempts.js';
import { coercePlanInfo } from './planInfo.js';
import { coerceAmount, coerceCarrier, coerceMoney, coerceProduct, isRecord, toBool, toNullableNum, toNum, toStr, } from './v3Coercion.js';
export { byAmount } from './prequalify-v3-types.js';
const PREQUALIFY_V3_PATH = '/v3/prequalify';
/**
 * Run a v3 prequalify call. Builds the wire body, mints a UUID v4 for
 * `Idempotency-Key` if the caller did not pass one, signs the request,
 * and parses the envelope into typed offers.
 */
export async function prequalifyV3(request, ctx) {
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
        return parsePrequalifyEnvelope(response.body, idempotencyKey, retryAttemptsFromHeaders(response.headers));
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
const V3_NICOTINE_FREQUENCY = {
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
function dollarsToCents(amount) {
    return Math.round(amount * CENTS_PER_DOLLAR);
}
/**
 * Serialize a {@link Condition} into the v3 `ConditionV3Input` wire shape.
 * SDK condition rows carry a freeform `name`; v3 accepts that as `text`
 * (with optional opaque catalog `id` from `GET /v3/datasets`). Date fields
 * pass through verbatim — the engine accepts ISO 8601, US format, and
 * relative phrases.
 */
function serializeV3Condition(c) {
    const row = { text: c.name };
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
function serializeV3Medication(m) {
    const row = { text: m.name };
    if (m.use !== undefined && m.use !== '')
        row['use'] = m.use;
    if (m.firstFill !== undefined && m.firstFill !== '')
        row['first_fill'] = m.firstFill;
    if (m.lastFill !== undefined && m.lastFill !== '')
        row['last_fill'] = m.lastFill;
    return row;
}
/**
 * Serialize one {@link NicotineProductUsage} into the v3
 * `NicotineSpecificityInput` shape. The v2 SDK calls the freeform name
 * `type`; v3 calls it `text`. Frequency is mapped through
 * {@link V3_NICOTINE_FREQUENCY} so v2-grade strings (`DAILY`, `WEEKLY`)
 * become valid v3 enum values (`daily`, `few_times_per_week`).
 */
function serializeV3NicotineSpecificity(p) {
    const frequency = V3_NICOTINE_FREQUENCY[p.frequency];
    if (frequency === undefined) {
        // Underwriting input: an unrecognized frequency must fail loudly.
        // Silently coercing it (the old behavior defaulted to 'daily') would
        // mis-price a smoker whose true frequency the caller mistyped.
        const allowed = [...new Set(Object.values(V3_NICOTINE_FREQUENCY))].join(', ');
        throw new Error(`Unknown nicotine frequency ${JSON.stringify(p.frequency)} for "${p.type}"; expected one of: ${allowed}`);
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
function serializeV3Nicotine(nicotineUse) {
    if (typeof nicotineUse === 'object' && nicotineUse !== null) {
        const input = nicotineUse;
        const result = {
            last_used: input.lastUsed,
        };
        if (input.productUsage !== undefined && input.productUsage.length > 0) {
            result.specificity = input.productUsage.map(serializeV3NicotineSpecificity);
        }
        return result;
    }
    const legacy = nicotineUse;
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
 * `state` is carried on the envelope per the v3 schema in both cases.
 */
function serializeV3Coverage(coverage, state) {
    if (isMulti(coverage)) {
        return {
            quote_options: {
                quote_type: coverage.type === 'face_value' ? QuoteType.FaceAmounts : QuoteType.MonthlyBudget,
                amounts: coverage.amounts.map((n) => String(n)),
            },
            state,
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
            state,
        };
    }
    return {
        face_amount_cents: dollarsToCents(coverage.amount),
        state,
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
 * `applicant.state` is moved into the coverage envelope per the v3
 * schema. `applicant.zip`, `options.minRank`, `options.showUnreleased`,
 * `options.skipHealthBasedUnderwriting`, `options.onlyProductClass`,
 * `options.includeProductClass` are not part of the v3 prequalify
 * envelope and are silently dropped — they survive on `/v3/quote` via
 * the legacy flat body.
 */
export function serializeV3PrequalifyBody(request) {
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
    if (Array.isArray(productsWire['include_product_class']) &&
        productsWire['include_product_class'].length > 0) {
        throw new Error('ProductSelection.byTypes is not supported on v3 prequalify; the v3 envelope accepts explicit products only. Use ProductSelection.of(...) here, or pin apiVersion { prequalify: "v2" } to select by product class.');
    }
    const productsList = Array.isArray(productsWire['products'])
        ? productsWire['products'].map((p) => String(p))
        : [];
    const applicantWire = {
        sex: applicant.sex,
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
    const payload = {
        applicant: applicantWire,
        coverage: serializeV3Coverage(coverage, applicant.state),
        products: productsList,
    };
    if (options?.includeIneligible !== undefined) {
        payload['include_ineligible'] = options.includeIneligible;
    }
    else {
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
export function serializeWireBody(request) {
    const { applicant, coverage, products, options } = request;
    const payload = {
        date_of_birth: applicant.dob,
        gender: applicant.sex,
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
            const fromSelection = payload['include_product_class'];
            const extra = options.includeProductClass.map((t) => t.wireToken);
            payload['include_product_class'] = [...new Set([...(fromSelection ?? []), ...extra])];
        }
        if (options.minRank !== undefined)
            payload['min_rank'] = options.minRank;
        if (options.showUnreleased !== undefined)
            payload['show_unreleased'] = options.showUnreleased;
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
function extractAmounts(coverage) {
    return isMulti(coverage) ? coverage.amounts : [coverage.amount];
}
function serializeNicotineUsage(nicotineUse) {
    if (typeof nicotineUse === 'object' && nicotineUse !== null) {
        const input = nicotineUse;
        const result = {
            last_used: input.lastUsed,
        };
        if (input.productUsage !== undefined && input.productUsage.length > 0) {
            result.product_usage = input.productUsage.map((p) => ({
                type: p.type,
                frequency: p.frequency,
            }));
        }
        return result;
    }
    const legacy = nicotineUse;
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
export async function buildHeaders(args) {
    const licenseHeaders = await buildLicenseHMACHeaders(args.auth.licenseKey, args.auth.orderId, args.auth.email, 'POST', args.path, args.body, args.auth.deviceId, args.clock ?? systemClock);
    const headers = {
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
export function mintUuidV4() {
    const bytes = new Uint8Array(16);
    const cryptoApi = typeof globalThis !== 'undefined'
        ? globalThis.crypto
        : undefined;
    if (cryptoApi?.getRandomValues) {
        cryptoApi.getRandomValues(bytes);
    }
    else {
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }
    // Version + variant bits per RFC 4122.
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = [];
    for (let i = 0; i < bytes.length; i++) {
        hex.push((bytes[i] ?? 0).toString(16).padStart(2, '0'));
    }
    return (hex.slice(0, 4).join('') +
        '-' +
        hex.slice(4, 6).join('') +
        '-' +
        hex.slice(6, 8).join('') +
        '-' +
        hex.slice(8, 10).join('') +
        '-' +
        hex.slice(10, 16).join(''));
}
// ---------------------------------------------------------------------------
// Response parsing.
// ---------------------------------------------------------------------------
function parsePrequalifyEnvelope(body, idempotencyKey, retryAttempts) {
    let parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch (err) {
        throw new Error(`ZyIns prequalifyV3: failed to parse response body: ${err.message}`);
    }
    const root = isRecord(parsed) ? parsed : {};
    const requestId = toStr(root['request_id']);
    const echoKey = toStr(root['idempotency_key']) || idempotencyKey;
    const livemode = root['livemode'] === undefined ? true : toBool(root['livemode']);
    const data = isRecord(root['data']) ? root['data'] : {};
    // The v3 response is always a flat `plans[]` array — single amount and
    // multi-amount alike. Group client-side with `byAmount` on the requested
    // dimension (deathBenefit for face amounts, budget for monthly budgets).
    // Absent plans (vs present-but-empty) indicates wire-shape drift; fail fast.
    if (!('plans' in data)) {
        throw new Error('ZyIns prequalifyV3: missing plans field in v3 response');
    }
    const plansRaw = Array.isArray(data['plans']) ? data['plans'] : [];
    const plans = plansRaw.map(coerceV3Offer);
    return {
        plans,
        requestId,
        idempotencyKey: echoKey,
        livemode,
        retryAttempts,
    };
}
function coerceEligibility(raw) {
    const r = isRecord(raw) ? raw : {};
    const categoryRaw = r['category'];
    const category = categoryRaw === 'immediate' ||
        categoryRaw === 'graded' ||
        categoryRaw === 'rop' ||
        categoryRaw === 'other'
        ? categoryRaw
        : null;
    const reasonsRaw = Array.isArray(r['reasons']) ? r['reasons'] : [];
    return {
        category,
        eligible: toBool(r['eligible']),
        reasons: reasonsRaw.map((x) => toStr(x)),
    };
}
function coercePremium(raw) {
    if (raw === null || raw === undefined)
        return undefined;
    if (!isRecord(raw))
        return undefined;
    const modesRaw = isRecord(raw['modes']) ? raw['modes'] : {};
    const modes = {};
    for (const [k, v] of Object.entries(modesRaw)) {
        modes[k] = coerceAmount(v);
    }
    return {
        cents: toNum(raw['cents']),
        display: toStr(raw['display']),
        default: coerceAmount(raw['default']),
        modes,
    };
}
export function coercePricingRow(raw) {
    const r = isRecord(raw) ? raw : {};
    const premium = coercePremium(r['premium']);
    const base = {
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
export function coerceV3Offer(raw) {
    const r = isRecord(raw) ? raw : {};
    const pricingRaw = Array.isArray(r['pricing']) ? r['pricing'] : [];
    const metadata = isRecord(r['metadata']) ? r['metadata'] : {};
    const planInfo = coercePlanInfo(r['plan_info']);
    const base = {
        object: 'plan_offer',
        id: toStr(r['id']),
        eligible: toBool(r['eligible']),
        carrier: coerceCarrier(r['carrier']),
        product: coerceProduct(r['product']),
        planInfo: planInfo.array,
        deathBenefit: coerceMoney(r['death_benefit']),
        pricing: pricingRaw.map(coercePricingRow),
        metadata,
        ...(isRecord(r['budget']) ? { budget: coerceMoney(r['budget']) } : {}),
    };
    return base;
}
//# sourceMappingURL=prequalify-v3.js.map