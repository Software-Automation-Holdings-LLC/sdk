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
const GZIP_ENCODING = 'gzip';
const GZIP_OS_BYTE_OFFSET = 9;
const LEGACY_GZIP_OS_BYTE = 0x13;
/**
 * Gzip-compress `input` and return the Form.enc wire envelope.
 *
 * `input` may be a UTF-8 string (encoded with TextEncoder) or raw bytes.
 * The returned `body` is base64 of the gzip stream.
 */
export async function compress(input) {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
    const compressedBytes = await gzipBytes(bytes);
    const body = bytesToBase64(compressedBytes);
    return { compressed: true, body };
}
/**
 * Decompress a Form.enc wire envelope back to the original UTF-8 string.
 */
export async function decompress(envelope) {
    if (!envelope || envelope.compressed !== true || typeof envelope.body !== 'string') {
        throw new Error('decompress: envelope must be {compressed: true, body: string}');
    }
    const compressedBytes = base64ToBytes(envelope.body);
    return gunzipBytes(compressedBytes);
}
/**
 * Lower-level: compress bytes via the platform CompressionStream API.
 * Exported for interop with legacy callers that bypass the envelope.
 */
export async function gzipBytes(bytes) {
    const CS = globalThis.CompressionStream;
    if (typeof CS === 'undefined') {
        throw new Error('CompressionStream is not supported in this environment');
    }
    const stream = new CS(GZIP_ENCODING);
    const writer = stream.writable.getWriter();
    try {
        await writer.write(toArrayBufferView(bytes));
        await writer.close();
    }
    finally {
        writer.releaseLock();
    }
    const buffer = await new Response(stream.readable).arrayBuffer();
    const out = new Uint8Array(buffer);
    out[GZIP_OS_BYTE_OFFSET] = LEGACY_GZIP_OS_BYTE;
    return out;
}
/**
 * Lower-level: decompress bytes via the platform DecompressionStream API.
 */
export async function gunzipBytes(bytes) {
    const DS = globalThis.DecompressionStream;
    if (typeof DS === 'undefined') {
        throw new Error('DecompressionStream is not supported in this environment');
    }
    const stream = new DS(GZIP_ENCODING);
    const writer = stream.writable.getWriter();
    try {
        await writer.write(toArrayBufferView(bytes));
        await writer.close();
    }
    finally {
        writer.releaseLock();
    }
    const buffer = await new Response(stream.readable).arrayBuffer();
    return new TextDecoder().decode(buffer);
}
/**
 * Return a Uint8Array view over an ArrayBuffer (not SharedArrayBuffer). The
 * platform stream writer types require `BufferSource<ArrayBuffer>`; a view
 * whose backing buffer is a SharedArrayBuffer is rejected. Copying into a
 * fresh ArrayBuffer is always safe for our use case.
 */
function toArrayBufferView(bytes) {
    const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
    copy.set(bytes);
    return copy;
}
/**
 * Convert bytes → base64 using the legacy latin1-binary-string path used by
 * the original SAH_Compress. This is the exact pipeline the PHP server
 * decoder expects.
 */
function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
/**
 * Convert base64 → bytes via the inverse of {@link bytesToBase64}.
 */
function base64ToBytes(base64) {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        out[i] = binary.charCodeAt(i);
    }
    return out;
}
//# sourceMappingURL=gzip.js.map