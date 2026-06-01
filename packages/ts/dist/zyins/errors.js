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
import { isProblemDetails } from '../core/index.js';
import { IsaApiError, IsaIdempotencyConflictError, IsaLicenseError, IsaRateLimitError, IsaUnauthorizedError, IsaValidationError, } from './apiError.js';
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
export function fromHttpResponse(status, body) {
    const trimmed = body.trim();
    if (status === 429) {
        return new IsaRateLimitError({ message: trimmed || 'rate limited' });
    }
    const asProblem = tryParseProblemDetails(trimmed);
    if (asProblem)
        return fromProblemDetails(asProblem);
    const asLegacy = tryParseLegacyErr(status, trimmed);
    if (asLegacy)
        return asLegacy;
    return new IsaApiError({ message: trimmed || `HTTP ${status}`, code: 'unknown', status });
}
/** Map a parsed ProblemDetails into the right `IsaApiError` subclass. */
export function fromProblemDetails(problem) {
    const message = problem.detail ?? problem.title;
    if (problem.code === 'idempotency_conflict') {
        const raw = problem;
        const ctorOpts = {
            message,
            key: typeof raw.key === 'string' ? raw.key : '',
            firstSeenAt: typeof raw.first_seen_at === 'string' ? raw.first_seen_at : '',
            raw: problem,
        };
        if (typeof raw.request_id === 'string')
            ctorOpts.requestId = raw.request_id;
        if (problem.doc_url !== undefined)
            ctorOpts.docUrl = problem.doc_url;
        return new IsaIdempotencyConflictError(ctorOpts);
    }
    if (problem.code === 'license_locked') {
        return new IsaLicenseError('locked', message, { status: problem.status, raw: problem });
    }
    if (problem.code === 'unauthorized') {
        return new IsaUnauthorizedError({ message, code: problem.code, raw: problem });
    }
    if (problem.code === 'validation_error') {
        const opts = { message, raw: problem };
        if (problem.param !== undefined)
            opts.param = problem.param;
        return new IsaValidationError(opts);
    }
    if (problem.code === 'rate_limit_exceeded' || problem.code === 'rate_limited') {
        return new IsaRateLimitError({ message, code: problem.code, raw: problem });
    }
    const opts = {
        message,
        code: problem.code,
        status: problem.status,
        raw: problem,
    };
    if (problem.param !== undefined)
        opts.param = problem.param;
    if (problem.doc_url !== undefined)
        opts.docUrl = problem.doc_url;
    return new IsaApiError(opts);
}
const INVALID_CREDENTIALS_CODE = 'invalid_credentials';
const LEGACY_ERR_MAP = {
    ERR_MAX_ACTIVATIONS: 'max_activations',
    ERR_INACTIVE: 'inactive',
    ERR_ACTIVE_ELSEWHERE: 'active_elsewhere',
    ERR_LOCKED: 'locked',
    ERR_INVALID_CREDENTIALS: INVALID_CREDENTIALS_CODE,
    NO_EMAIL: 'no_email',
};
/** Best-effort ProblemDetails parse; returns `undefined` for non-JSON bodies. */
function tryParseProblemDetails(body) {
    if (!body.startsWith('{'))
        return undefined;
    try {
        const parsed = JSON.parse(body);
        return isProblemDetails(parsed) ? parsed : undefined;
    }
    catch {
        return undefined;
    }
}
/**
 * Map a known legacy token to an `IsaLicenseError`. Unknown `ERR_*` strings
 * collapse to `unknown` so consumers never have to mirror the exhaustive
 * token list themselves.
 */
function tryParseLegacyErr(status, body) {
    const mapped = LEGACY_ERR_MAP[body];
    if (mapped)
        return new IsaLicenseError(mapped, body, { status });
    if (body.startsWith('ERR_'))
        return new IsaLicenseError('unknown', body, { status });
    return undefined;
}
//# sourceMappingURL=errors.js.map