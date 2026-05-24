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
import { NicotineUsage, NicotineDuration } from './applicant';
import { QuoteType, isMulti, } from './coverage';
import { Products } from './product';
import { fromHttpResponse } from './errors';
import { deriveIdempotencyKey } from './idempotency';
import { buildLicenseHMACHeaders } from '../core';
import { systemClock } from '../core';
const PREQUALIFY_PATH = '/v1/prequalify';
/**
 * Run a prequalify call. Builds the wire body, derives the idempotency key,
 * signs the request, and parses the response into typed plans.
 */
export async function prequalify(request, ctx) {
    const body = serializeWireBody(request);
    return executePrequalify(body, request, ctx);
}
async function executePrequalify(body, request, ctx) {
    const idempotencyKey = ctx.idempotencyKey ??
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
function serializeWireBody(request) {
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
            // Merge with ProductSelection-emitted include_product_class.
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
async function buildPrequalifyHeaders(args) {
    const licenseHeaders = await buildLicenseHMACHeaders(args.auth.licenseKey, args.auth.orderId, args.auth.email, 'POST', PREQUALIFY_PATH, args.body, args.auth.deviceId, args.clock ?? systemClock);
    return {
        ...licenseHeaders,
        'Content-Type': 'application/json',
        'Idempotency-Key': args.idempotencyKey,
    };
}
const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const toStr = (v) => (typeof v === 'string' ? v : '');
const toNum = (v) => (typeof v === 'number' ? v : 0);
const toBool = (v) => v === true;
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
function parsePrequalifyResponse(body, coverage, idempotencyKey) {
    let parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch (err) {
        throw new Error(`ZyIns prequalify: failed to parse response body: ${err.message}`);
    }
    const root = isRecord(parsed) ? parsed : {};
    const requestId = toStr(root['request_id']);
    const echoKey = toStr(root['idempotency_key']) || idempotencyKey;
    const data = isRecord(root['data']) ? root['data'] : {};
    const meta = parseMeta(data['meta']);
    const results = isRecord(data['results']) ? data['results'] : {};
    const byAmount = new Map();
    for (const [amtKey, plansRaw] of Object.entries(results)) {
        const amt = Number(amtKey);
        if (!Number.isFinite(amt))
            continue;
        const list = Array.isArray(plansRaw) ? plansRaw.map(coercePlan) : [];
        byAmount.set(amt, list);
    }
    if (isMulti(coverage)) {
        const amounts = coverage.amounts.slice().map((n) => Math.round(n));
        const flat = [];
        for (const a of amounts) {
            const list = byAmount.get(a) ?? [];
            for (const p of list)
                flat.push(p);
        }
        return {
            kind: 'multi',
            amounts,
            byAmount,
            plans: flat,
            forAmount(n) {
                if (!amounts.includes(n)) {
                    throw new Error(`MultiPrequalifyResult.forAmount: amount ${n} not requested; available: ${amounts.join(', ')}`);
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
function parseMeta(raw) {
    if (!isRecord(raw)) {
        return { amounts: [], processingTimeMs: 0, quoteType: 'face_value', totalProducts: 0 };
    }
    const amountsRaw = Array.isArray(raw['amounts']) ? raw['amounts'] : [];
    const amounts = amountsRaw
        .map((v) => Number(typeof v === 'string' ? v : v))
        .filter((n) => Number.isFinite(n));
    const quoteTypeRaw = toStr(raw['quote_type']);
    const quoteType = quoteTypeRaw === 'monthly_budget' ? 'monthly_budget' : 'face_value';
    return {
        amounts,
        processingTimeMs: toNum(raw['processing_time_ms']),
        quoteType,
        totalProducts: toNum(raw['total_products']),
    };
}
function coercePlan(raw) {
    const r = isRecord(raw) ? raw : {};
    const id = toStr(r['id']);
    const monthlyPriceRaw = r['monthly_price'];
    let monthlyPrice;
    if (typeof monthlyPriceRaw === 'number') {
        monthlyPrice = monthlyPriceRaw;
    }
    else if (typeof monthlyPriceRaw === 'string') {
        const cleaned = monthlyPriceRaw.replace(/[^0-9.]/g, '');
        monthlyPrice = cleaned === '' ? undefined : Number(cleaned);
    }
    const planInfoRaw = isRecord(r['plan_info']) ? r['plan_info'] : {};
    const planInfo = {};
    for (const [k, v] of Object.entries(planInfoRaw)) {
        planInfo[k] = Array.isArray(v) ? v.map((x) => toStr(x)) : [];
    }
    const pricingRaw = isRecord(r['pricing']) ? r['pricing'] : {};
    const pricing = {};
    for (const [k, v] of Object.entries(pricingRaw)) {
        if (isRecord(v)) {
            pricing[k] = { ...v, monthly: toNum(v['monthly']) };
        }
    }
    const plan = {
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
    if (hydrated)
        plan.product = hydrated;
    return plan;
}
//# sourceMappingURL=prequalify.js.map