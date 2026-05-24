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
import { NicotineUsage, NicotineDuration } from './applicant';
import { QuoteType } from './coverage';
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
    return executePrequalify(body, ctx);
}
async function executePrequalify(body, ctx) {
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
function serializeWireBody(request) {
    const { applicant, coverage, products } = request;
    const payload = {
        date_of_birth: applicant.dob,
        gender: applicant.sex,
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
function serializeNicotineUsage(nicotineUse) {
    // Modern structured input
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
    // Deprecated enum — map to the closest NicotineLastUsed value
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
function serializeQuoteOptions(coverage) {
    return {
        amounts: [String(coverage.amount)],
        quote_type: coverage.type === 'face_value' ? QuoteType.FaceAmounts : QuoteType.MonthlyBudget,
    };
}
/** Build the per-request headers (auth + idempotency + content-type). */
async function buildPrequalifyHeaders(args) {
    const licenseHeaders = await buildLicenseHMACHeaders(args.auth.licenseKey, args.auth.orderId, args.auth.email, 'POST', PREQUALIFY_PATH, args.body, args.auth.deviceId, args.clock ?? systemClock);
    return {
        ...licenseHeaders,
        'Content-Type': 'application/json',
        'Idempotency-Key': args.idempotencyKey,
    };
}
const toStr = (v) => (typeof v === 'string' ? v : '');
const toNum = (v) => (typeof v === 'number' ? v : 0);
const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** Coerce the engine's JSON response into the typed shape. */
function parsePrequalifyResponse(body) {
    let parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch (err) {
        throw new Error(`ZyIns prequalify: failed to parse response body: ${err.message}`);
    }
    const root = isRecord(parsed) ? parsed : {};
    const plans = Array.isArray(root['plans']) ? root['plans'].map(coercePlan) : [];
    const requestId = toStr(root['request_id']);
    return { plans, requestId };
}
function coercePlan(raw) {
    const r = isRecord(raw) ? raw : {};
    return {
        brand: toStr(r['brand']),
        tier: toStr(r['tier']),
        monthlyPremium: toNum(r['monthly_premium']),
        faceValue: toNum(r['face_value']),
        productToken: toStr(r['product_token']),
    };
}
//# sourceMappingURL=prequalify.js.map