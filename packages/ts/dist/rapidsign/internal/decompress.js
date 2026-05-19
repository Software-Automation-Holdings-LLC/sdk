/**
 * Gzip decompression facade.
 *
 * The wire protocol always ships signed PDFs as gzip + base64. `download()`
 * always returns decompressed bytes — inflation is invisible. We use
 * `node:zlib`'s `gunzipSync` rather than the platform `DecompressionStream`
 * because RapidSign's SDK is intentionally a Node-only, server-to-server
 * client (per ADR-019 the surface is bearer-only with no CORS exposure).
 *
 * The facade is injectable via `Decompressor`; tests substitute a stub so
 * they exercise the surrounding wire-decoding logic without a live zlib.
 */
import { gunzipSync } from 'node:zlib';
/** Default decompressor uses Node's synchronous zlib. */
export const defaultDecompressor = (gzipped) => gunzipSync(gzipped);
/**
 * Decode a base64 gzip payload to a fresh Buffer. The base64 alphabet is
 * the standard one (RFC 4648 §4); URL-safe alphabets are not produced by
 * the server.
 */
export function decodeGzipBase64(base64, decompressor = defaultDecompressor) {
    const gzipped = Buffer.from(base64, 'base64');
    return decompressor(gzipped);
}
//# sourceMappingURL=decompress.js.map