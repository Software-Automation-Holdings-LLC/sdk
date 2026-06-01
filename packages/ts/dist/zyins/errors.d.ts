/**
 * Typed error funnel.
 *
 * The ZyINS API speaks two error dialects in flight today:
 *
 * 1. Modern ProblemDetails (RFC 7807) — the future. Returned by the new
 *    Connect-RPC v1 endpoints.
 * 2. Legacy ERR_* magic strings — returned by the licensing CGI as raw
 *    text/plain. bpp2.0's `useSoftwareActivator.js` switches on each code
 *    rather than the raw string.
 *
 * `fromHttpResponse` parses the status + body and returns the right
 * `IsaApiError` subclass; the caller switches on `error.code` — never on HTTP
 * status, never on message text. Every error descends from the single
 * `IsaError` base (apiError.ts), so a consumer catches once and dispatches on
 * `code`. This is the "legacy error formats are absorbed" invariant from
 * ADR-035.
 */
import { type ProblemDetails } from '../core/index.js';
import { IsaApiError } from './apiError.js';
/**
 * Parse a raw HTTP response (status + body) into a typed `IsaApiError`.
 *
 * Resolution order:
 * 1. status 429 → `IsaRateLimitError`.
 * 2. Body is a ProblemDetails JSON → map by `code`.
 * 3. Body is a legacy ERR_* string → `IsaLicenseError`.
 * 4. Fallback → `IsaApiError` with code `unknown`.
 *
 * The caller always gets a typed value; `null` or `undefined` is never
 * returned even for malformed responses. This is the absorption boundary.
 */
export declare function fromHttpResponse(status: number, body: string): IsaApiError;
/** Map a parsed ProblemDetails into the right `IsaApiError` subclass. */
export declare function fromProblemDetails(problem: ProblemDetails): IsaApiError;
//# sourceMappingURL=errors.d.ts.map