/**
 * Tier 3 prequalify v2 operation — `POST /v2/prequalify`.
 *
 * v2 returns the modern envelope shape with one `PlanOffer` per product;
 * each entry carries the **best qualifying** category at the top level and
 * alternate categories nested in `other_offers[]`. Ineligible products /
 * tiers surface only when `include_ineligible: true`.
 *
 * Locked invariants (mirroring v1):
 *   - The wire body is built by the SDK; the call site never sees it.
 *   - The idempotency key is derived from sessionId:op:body-hash unless
 *     overridden via `ctx.idempotencyKey`.
 *   - Auth credentials live in HMAC headers only — never in the body.
 *
 * Typed value objects live in `prequalify-v2-types.ts`; this file owns the
 * wire serialization, header building, and response parsing.
 */
import { NicotineUsage, NicotineDuration } from './applicant';
import { QuoteType, isMulti } from './coverage';
import { fromHttpResponse } from './errors';
import { deriveIdempotencyKey } from './idempotency';
import { buildLicenseHMACHeaders } from '../core';
import { systemClock } from '../core';
import { coercePlanInfo } from './planInfo';
import { retryAttemptsFromHeaders } from './retryAttempts';
const PREQUALIFY_V2_PATH = '/v2/prequalify';
/**
 * Run a v2 prequalify call. Builds the wire body, derives the idempotency
 * key, signs the request, and parses the envelope into typed offers.
 */
export async function prequalifyV2(request, ctx) {
    const body = serializeWireBody(request);
    const idempotencyKey = ctx.idempotencyKey ??
        (await deriveIdempotencyKey({ deviceId: ctx.auth.deviceId, op: 'prequalify_v2', body }));
    const headers = await buildHeaders({
        auth: ctx.auth,
        body,
        idempotencyKey,
        clock: ctx.clock,
    });
    const url = `${ctx.baseUrl}${PREQUALIFY_V2_PATH}`;
    const response = await ctx.transport({ url, method: 'POST', headers, body });
    if (response.status >= 200 && response.status < 300) {
        return parseEnvelope(response.body, idempotencyKey, retryAttemptsFromHeaders(response.headers));
    }
    throw fromHttpResponse(response.status, response.body);
}
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
    // SDK-side default (matches the bpp2.0 shim that this PR absorbs):
    // surface declined products + declined alternates so consumers can
    // render an "Excluded" panel without an explicit opt-in. Server-side
    // also defaults to true post-zyins#345; this is a defensive belt for
    // older deployments and for v1 callers who pre-shim their bodies.
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
async function buildHeaders(args) {
    const licenseHeaders = await buildLicenseHMACHeaders(args.auth.licenseKey, args.auth.orderId, args.auth.email, 'POST', PREQUALIFY_V2_PATH, args.body, args.auth.deviceId, args.clock ?? systemClock);
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
const toNullableNum = (v) => typeof v === 'number' && Number.isFinite(v) ? v : null;
const toNullableStr = (v) => (typeof v === 'string' ? v : null);
function parseEnvelope(body, idempotencyKey, retryAttempts) {
    let parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch (err) {
        throw new Error(`ZyIns prequalifyV2: failed to parse response body: ${err.message}`);
    }
    const root = isRecord(parsed) ? parsed : {};
    const requestId = toStr(root['request_id']);
    const echoKey = toStr(root['idempotency_key']) || idempotencyKey;
    const livemode = root['livemode'] === undefined ? true : toBool(root['livemode']);
    const data = isRecord(root['data']) ? root['data'] : {};
    const plansRaw = Array.isArray(data['plans']) ? data['plans'] : [];
    const plans = plansRaw.map(coercePlanOffer);
    return {
        plans,
        has_more: toBool(data['has_more']),
        next_cursor: toNullableStr(data['next_cursor']),
        requestId,
        idempotencyKey: echoKey,
        livemode,
        retryAttempts,
    };
}
function coerceEligibility(raw) {
    const r = isRecord(raw) ? raw : {};
    const categoryRaw = r['category'];
    const category = categoryRaw === 'immediate' || categoryRaw === 'graded' || categoryRaw === 'rop'
        ? categoryRaw
        : null;
    const reasonsRaw = Array.isArray(r['reasons']) ? r['reasons'] : [];
    return {
        eligible: toBool(r['eligible']),
        category,
        coverage_tier: toNullableStr(r['coverage_tier']),
        reasons: reasonsRaw.map((x) => toStr(x)),
    };
}
function coerceCarrier(raw) {
    const r = isRecord(raw) ? raw : {};
    return {
        id: toStr(r['id']),
        name: toStr(r['name']),
        logo_url: toStr(r['logo_url']),
    };
}
function coerceProduct(raw) {
    const r = isRecord(raw) ? raw : {};
    return {
        id: toStr(r['id']),
        slug: toStr(r['slug']),
        name: toStr(r['name']),
        display_name: toStr(r['display_name']),
        type: toStr(r['type']),
        wire_token: toStr(r['wire_token']),
    };
}
function coerceMoney(raw) {
    const r = isRecord(raw) ? raw : {};
    return {
        cents: toNum(r['cents']),
        display: toStr(r['display']),
    };
}
function coercePremium(raw) {
    if (raw === null || raw === undefined)
        return null;
    if (!isRecord(raw))
        return null;
    const modesRaw = isRecord(raw['modes']) ? raw['modes'] : {};
    const modes = {};
    for (const [k, v] of Object.entries(modesRaw)) {
        modes[k] = coerceMoney(v);
    }
    return {
        cents: toNum(raw['cents']),
        display: toStr(raw['display']),
        mode: toStr(raw['mode']),
        rate_class: toStr(raw['rate_class']),
        modes,
    };
}
function coerceOtherOffer(raw) {
    const r = isRecord(raw) ? raw : {};
    return {
        rank: toNullableNum(r['rank']),
        eligibility: coerceEligibility(r['eligibility']),
        premium: coercePremium(r['premium']),
    };
}
function mergePlanInfo(primary, secondary) {
    if (secondary.length === 0)
        return primary;
    const keys = new Set(primary.map((entry) => entry.key));
    return [...primary, ...secondary.filter((entry) => !keys.has(entry.key))];
}
function mergePlanInfoLegacy(planInfoLegacy, wireLegacy) {
    const merged = { ...(wireLegacy ?? {}), ...(planInfoLegacy ?? {}) };
    return Object.keys(merged).length === 0 ? undefined : merged;
}
function coercePlanOffer(raw) {
    const r = isRecord(raw) ? raw : {};
    const otherOffersRaw = Array.isArray(r['other_offers']) ? r['other_offers'] : [];
    const metadata = isRecord(r['metadata']) ? r['metadata'] : {};
    const planInfo = coercePlanInfo(r['plan_info']);
    const legacyPlanInfo = coercePlanInfo(r['plan_info_legacy']);
    const planInfoLegacy = mergePlanInfoLegacy(planInfo.legacy, legacyPlanInfo.legacy);
    return {
        object: 'plan_offer',
        id: toStr(r['id']),
        result_index: toNum(r['result_index']),
        rank: toNullableNum(r['rank']),
        eligibility: coerceEligibility(r['eligibility']),
        carrier: coerceCarrier(r['carrier']),
        product: coerceProduct(r['product']),
        plan_info: mergePlanInfo(planInfo.array, legacyPlanInfo.array),
        ...(planInfoLegacy === undefined ? {} : { plan_info_legacy: planInfoLegacy }),
        death_benefit: coerceMoney(r['death_benefit']),
        premium: coercePremium(r['premium']),
        other_offers: otherOffersRaw.map(coerceOtherOffer),
        metadata,
    };
}
//# sourceMappingURL=prequalify-v2.js.map