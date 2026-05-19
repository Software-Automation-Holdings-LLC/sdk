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

export interface Envelope<T = unknown> {
    object: string;
    livemode: boolean;
    request_id: string;
    data: T;
}

export const ERR_ENVELOPE_MISSING_DATA = 'transport: response envelope has no data field';
export const ERR_ENVELOPE_SHAPE = 'transport: response body is not a JSON object';

/**
 * Validator narrows an unknown JSON value into a typed payload. Throws
 * on shape mismatch; the extractor surfaces the throw to the caller.
 *
 * Per-product SDK code generates validators from protobuf message
 * descriptors — those validators check every field. Application code
 * may pass an ad-hoc validator for prototypes; production code should
 * always use the generated one.
 */
export type DataValidator<T> = (raw: unknown) => T;

function isJSONObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readEnvelope(parsed: unknown): Record<string, unknown> {
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
export async function extractData<T>(response: Response, validator: DataValidator<T>): Promise<T> {
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
export async function extractEnvelope(response: Response): Promise<Envelope<unknown>> {
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
