/**
 * Place a caller-supplied value into a request path as exactly one segment.
 *
 * Percent-encoding alone does not keep a value in its segment. `.` and `..`
 * pass through `encodeURIComponent` unchanged and are resolved as dot
 * segments (by `new URL` itself, before the request leaves), and a gateway
 * that decodes once turns an encoded `/` back into a separator. Either way
 * the request, and the credentials attached to it, lands on another route.
 */

/** Bytes some hop may treat as a segment boundary once decoded. */
const SEPARATORS = /[/\\%]/;

/**
 * Return `value` encoded as exactly one URL path segment.
 *
 * @throws Error for a non-string, the empty string, `.` and `..`, and any
 *   value containing `/`, `\`, or `%`.
 */
export function pathSegment(value: string): string {
  if (typeof value !== "string" || value === "" || value === "." || value === ".." || SEPARATORS.test(value)) {
    throw new Error(`${JSON.stringify(value)} is not a single path segment`);
  }
  return encodeURIComponent(value);
}
