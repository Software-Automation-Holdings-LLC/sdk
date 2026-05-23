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
import { sexWireCode } from './applicant';
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
    const body = serializePrequalifyBody(request, ctx.auth);
    return prequalifyBody(body, ctx);
}
/**
 * Run a prequalify call from a pre-encoded payload. Same path, same
 * headers, same response shape as the typed `prequalify`.
 */
export async function prequalifyLegacyBlob(request, ctx) {
    const body = JSON.stringify(request.encodedPayload);
    return prequalifyBody(body, ctx);
}
async function prequalifyBody(body, ctx) {
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
 * Serialize the prequalify request to the wire body. Pulled into a separate
 * function so the idempotency key is computed over the exact bytes that go
 * on the wire.
 */
function serializePrequalifyBody(request, auth) {
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
async function buildPrequalifyHeaders(args) {
    const licenseHeaders = await buildLicenseHMACHeaders(args.auth.licenseKey, args.auth.orderId, args.auth.email, 'POST', PREQUALIFY_PATH, args.body, args.auth.deviceId, args.clock ?? systemClock);
    return {
        ...licenseHeaders,
        'Content-Type': 'application/json',
        'Idempotency-Key': args.idempotencyKey,
    };
}
/** Coerce the engine's JSON response into the typed shape. */
function parsePrequalifyResponse(body) {
    let parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch (err) {
        throw new Error(`ZyIns prequalify: failed to parse response body: ${err.message}`);
    }
    const plans = Array.isArray(parsed.plans) ? parsed.plans.map(coercePlan) : [];
    const requestId = typeof parsed.request_id === 'string' ? parsed.request_id : '';
    return { plans, requestId };
}
function coercePlan(raw) {
    return {
        brand: typeof raw.brand === 'string' ? raw.brand : '',
        tier: typeof raw.tier === 'string' ? raw.tier : '',
        monthlyPremium: typeof raw.monthly_premium === 'number' ? raw.monthly_premium : 0,
        faceValue: typeof raw.face_value === 'number' ? raw.face_value : 0,
        productToken: typeof raw.product_token === 'string' ? raw.product_token : '',
    };
}
//# sourceMappingURL=prequalify.js.map