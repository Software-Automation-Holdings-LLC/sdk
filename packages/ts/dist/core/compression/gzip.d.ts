/**
 * Gzip + base64 compression used by the eapp-system Form.enc wire protocol.
 *
 * WIRE-CRITICAL: the output format (gzip bytes → latin1 binary string → btoa)
 * is fixed. The PHP server and cached browser data round-trip through this
 * exact pipeline. Do NOT swap the algorithm, change the base64 encoder, or
 * alter byte ordering.
 *
 * This module is NOT authentication and NOT confidentiality. It is a
 * transport-size optimization. Any security-sensitive payload must be
 * encrypted separately before compression.
 *
 * Ported verbatim from eapp-system/resources/js/lib/Compression.js
 * (`SAH_Compress` / `SAH_Decompress`).
 */
/**
 * Envelope produced by {@link compress} and consumed by {@link decompress}.
 * The shape matches the Form.enc wire protocol: `{compressed: true, body}`.
 */
export interface CompressionEnvelope {
    readonly compressed: true;
    readonly body: string;
}
/**
 * Gzip-compress `input` and return the Form.enc wire envelope.
 *
 * `input` may be a UTF-8 string (encoded with TextEncoder) or raw bytes.
 * The returned `body` is base64 of the gzip stream.
 */
export declare function compress(input: string | Uint8Array): Promise<CompressionEnvelope>;
/**
 * Decompress a Form.enc wire envelope back to the original UTF-8 string.
 */
export declare function decompress(envelope: CompressionEnvelope): Promise<string>;
/**
 * Lower-level: compress bytes via the platform CompressionStream API.
 * Exported for interop with legacy callers that bypass the envelope.
 */
export declare function gzipBytes(bytes: Uint8Array): Promise<Uint8Array>;
/**
 * Lower-level: decompress bytes via the platform DecompressionStream API.
 */
export declare function gunzipBytes(bytes: Uint8Array): Promise<string>;
//# sourceMappingURL=gzip.d.ts.map