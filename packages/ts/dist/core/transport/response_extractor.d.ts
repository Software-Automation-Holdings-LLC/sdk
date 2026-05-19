export interface Envelope<T = unknown> {
    object: string;
    livemode: boolean;
    request_id: string;
    data: T;
}
export declare const ERR_ENVELOPE_MISSING_DATA = "transport: response envelope has no data field";
export declare const ERR_ENVELOPE_SHAPE = "transport: response body is not a JSON object";
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
/**
 * Reads the response body, validates the envelope shape, then runs the
 * caller's validator against the inner `data` payload. Returning a
 * validated T (rather than a blind cast) prevents shape mismatches from
 * propagating into application code.
 */
export declare function extractData<T>(response: Response, validator: DataValidator<T>): Promise<T>;
/**
 * Returns the envelope without validating the inner data. Useful when
 * the caller wants request_id for logging before committing to a
 * payload type. The returned `data` is typed as `unknown`; downstream
 * code MUST narrow before using it.
 */
export declare function extractEnvelope(response: Response): Promise<Envelope<unknown>>;
//# sourceMappingURL=response_extractor.d.ts.map