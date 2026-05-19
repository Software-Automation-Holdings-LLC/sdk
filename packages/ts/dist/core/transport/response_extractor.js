/*
 * Response envelope extractor for the unified ISA SDK.
 *
 * ADR-012 envelope shape:
 *   { "object": "...", "livemode": bool, "request_id": "...", "data": ... }
 *
 * The helpers below peel the envelope and surface `request_id` for
 * logging. Validation of the inner `data` payload is the caller's
 * responsibility — supply a `validator` callback that asserts the shape
 * and returns the typed value. This separation matches Stripe-node's
 * `Stripe.responseHandler` pattern: the envelope code is generic; the
 * per-endpoint validator is specific.
 */
export const ERR_ENVELOPE_MISSING_DATA = 'transport: response envelope has no data field';
export const ERR_ENVELOPE_SHAPE = 'transport: response body is not a JSON object';
function isJSONObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function readEnvelope(parsed) {
    if (!isJSONObject(parsed)) {
        throw new Error(ERR_ENVELOPE_SHAPE);
    }
    return parsed;
}
/**
 * Reads the response body, validates the envelope shape, then runs the
 * caller's validator against the inner `data` payload. Returning a
 * validated T (rather than a blind cast) prevents shape mismatches from
 * propagating into application code.
 */
export async function extractData(response, validator) {
    if (!response) {
        throw new Error('transport: extractData requires a Response');
    }
    if (!validator) {
        throw new Error('transport: extractData requires a DataValidator (use generated validator from sdk/<product>)');
    }
    const env = readEnvelope(await response.json());
    if (!('data' in env) || env.data === undefined || env.data === null) {
        throw new Error(ERR_ENVELOPE_MISSING_DATA);
    }
    return validator(env.data);
}
/**
 * Returns the envelope without validating the inner data. Useful when
 * the caller wants request_id for logging before committing to a
 * payload type. The returned `data` is typed as `unknown`; downstream
 * code MUST narrow before using it.
 */
export async function extractEnvelope(response) {
    if (!response) {
        throw new Error('transport: extractEnvelope requires a Response');
    }
    const env = readEnvelope(await response.json());
    return {
        object: typeof env.object === 'string' ? env.object : '',
        livemode: typeof env.livemode === 'boolean' ? env.livemode : false,
        request_id: typeof env.request_id === 'string' ? env.request_id : '',
        data: env.data,
    };
}
//# sourceMappingURL=response_extractor.js.map