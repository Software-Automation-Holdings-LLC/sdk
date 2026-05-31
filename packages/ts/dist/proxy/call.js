/**
 * `proxy.call()` — structured invocation against `/v1/call`, signed with
 * canonical session-credential HMAC.
 *
 * Wire envelope (opaque pass-through; do NOT flatten):
 *
 *   { integration_id | integration_uuid, method, params }
 *
 * Auth headers come from `signRequest()` (the canonical session signer):
 *
 *   Authorization, X-Isa-Session-Id, X-Isa-Timestamp, X-Isa-Signature
 *
 * Plus `Idempotency-Key` (auto-minted UUID v4 if the caller omits one)
 * and `Content-Type: application/json`.
 *
 * This is the SDK↔proxy hop. The proxy↔downstream hop remains Algosure
 * HMAC and is handled server-side — see ADR-035 (amended in this PR).
 */
import { IsaApiError, IsaConfigError, IsaIdempotencyConflictError, IsaUnauthorizedError, IsaValidationError, } from '../zyins/apiError.js';
import { signRequest } from '../core/auth/signRequest.js';
const PROXY_CALL_PATH = '/v1/call';
/**
 * Execute one call against `/v1/call`. The binding carries credentials and
 * origin; per-call options carry the integration target and params.
 */
export async function proxyCall(binding, opts) {
    validateIdentifier(opts);
    const body = buildEnvelopeBody(opts);
    const idempotencyKey = opts.idempotencyKey ?? mintUuidV4(opts.uuid);
    const { headers: signed } = await signRequest({
        method: 'POST',
        path: PROXY_CALL_PATH,
        body,
        sessionId: binding.identity.sessionId,
        sessionSecret: binding.identity.sessionSecret,
        ...(opts.clock !== undefined ? { clock: opts.clock } : {}),
    });
    const url = `${binding.proxyOrigin.replace(/\/$/, '')}${PROXY_CALL_PATH}`;
    const headers = {
        ...signed,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
    };
    const fetchFn = opts.fetchImpl ?? fetch;
    const response = await fetchFn(url, { method: 'POST', headers, body });
    return handleResponse(response);
}
function validateIdentifier(opts) {
    const hasUUID = hasIntegrationUuid(opts.integrationUuid);
    const hasID = hasIntegrationId(opts.integrationId);
    if (opts.integrationId !== undefined && !hasID) {
        throw new IsaValidationError({
            message: 'proxy.call: integrationId must be a positive integer',
            param: 'integration_id',
        });
    }
    if (hasUUID && hasID) {
        throw new IsaValidationError({
            message: 'proxy.call: supply exactly one of integrationUuid or integrationId',
            param: 'integration_uuid',
        });
    }
    if (!hasUUID && !hasID) {
        throw new IsaValidationError({
            message: 'proxy.call: supply exactly one of integrationUuid or integrationId',
            param: 'integration_uuid',
        });
    }
}
/**
 * Serialize the envelope deterministically. The same input must yield the
 * same byte sequence on every call so the signature over the body matches
 * the bytes on the wire.
 */
function buildEnvelopeBody(opts) {
    const envelope = {};
    if (hasIntegrationUuid(opts.integrationUuid)) {
        envelope.integration_uuid = opts.integrationUuid;
    }
    else {
        envelope.integration_id = opts.integrationId;
    }
    envelope.method = opts.method ?? 'POST';
    envelope.params = opts.params ?? null;
    return JSON.stringify(envelope);
}
function hasIntegrationUuid(value) {
    return typeof value === 'string' && value.length > 0;
}
function hasIntegrationId(value) {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
/**
 * Map response status to typed errors. Only the three explicit cases land
 * as typed subclasses; everything else falls through to `IsaApiError`.
 */
async function handleResponse(response) {
    const text = await response.text();
    const parsed = parseJsonOrUndefined(text);
    if (response.status >= 200 && response.status < 300) {
        return parsed;
    }
    const code = extractCode(parsed);
    const detail = extractDetail(parsed, text);
    const requestId = extractRequestId(parsed);
    if (response.status === 401) {
        throw new IsaUnauthorizedError({
            message: detail,
            code,
            ...(requestId !== undefined && { requestId }),
            raw: parsed,
        });
    }
    if (response.status === 400) {
        throw new IsaValidationError({
            message: detail,
            code,
            ...(requestId !== undefined && { requestId }),
            raw: parsed,
        });
    }
    if (response.status === 409 && code === 'idempotency_conflict') {
        throw new IsaIdempotencyConflictError({
            message: detail,
            key: extractKey(parsed),
            firstSeenAt: extractFirstSeenAt(parsed),
            ...(requestId !== undefined && { requestId }),
            raw: parsed,
        });
    }
    throw new IsaApiError({
        message: detail,
        code: code ?? 'api_error',
        status: response.status,
        ...(requestId !== undefined && { requestId }),
        raw: parsed,
    });
}
function parseJsonOrUndefined(text) {
    if (!text)
        return undefined;
    try {
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
function extractCode(parsed) {
    if (parsed && typeof parsed === 'object' && 'code' in parsed) {
        const v = parsed.code;
        return typeof v === 'string' ? v : undefined;
    }
    return undefined;
}
function extractDetail(parsed, fallback) {
    if (parsed && typeof parsed === 'object') {
        const obj = parsed;
        if (typeof obj.detail === 'string')
            return obj.detail;
        if (typeof obj.message === 'string')
            return obj.message;
    }
    return fallback || 'proxy.call failed';
}
function extractRequestId(parsed) {
    if (parsed && typeof parsed === 'object') {
        const v = parsed.request_id;
        return typeof v === 'string' ? v : undefined;
    }
    return undefined;
}
function extractKey(parsed) {
    if (parsed && typeof parsed === 'object') {
        const v = parsed.key;
        if (typeof v === 'string')
            return v;
    }
    return '';
}
function extractFirstSeenAt(parsed) {
    if (parsed && typeof parsed === 'object') {
        const v = parsed.first_seen_at;
        if (typeof v === 'string')
            return v;
    }
    return '';
}
/** Validate the binding identity is session-mode; throw IsaConfigError otherwise. */
export function assertSessionIdentityForProxyCall(identity) {
    if (identity.mode !== 'session') {
        throw new IsaConfigError('proxy.call requires a Session identity; exchange your bearer/license credentials via account.sessions.create first');
    }
}
/**
 * Mint a UUID v4. Uses crypto.randomUUID when present (Node 14.17+, all
 * modern browsers); falls back to a Math.random construction for ancient
 * runtimes — never relied on for cryptographic strength because the
 * idempotency key need only be globally unique.
 */
function mintUuidV4(injected) {
    if (injected)
        return injected();
    const g = globalThis;
    if (g.crypto && typeof g.crypto.randomUUID === 'function') {
        return g.crypto.randomUUID();
    }
    return fallbackUuidV4();
}
function fallbackUuidV4() {
    const hex = '0123456789abcdef';
    let out = '';
    for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
            out += '-';
            continue;
        }
        if (i === 14) {
            out += '4';
            continue;
        }
        const r = Math.floor(Math.random() * 16);
        if (i === 19) {
            out += hex[(r & 0x3) | 0x8];
            continue;
        }
        out += hex[r];
    }
    return out;
}
//# sourceMappingURL=call.js.map