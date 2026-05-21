/**
 * Tier 3 health/readiness probe.
 *
 * Targets the shared platform `/ready` endpoint defined in
 * `shared/schemas/api/isa/v1/health.proto`. Liveness (`/health`) ships
 * in a follow-up PR; readiness is the first surfaced operation because
 * it is the signal load balancers and runbooks rely on.
 *
 * The probe is unauthenticated — load balancers must be able to call
 * it without credentials. We still send any auth headers attached to
 * the client; the server ignores them on this route.
 */
import { fromHttpResponse } from './errors';
const READINESS_PATH = '/ready';
/**
 * Query the platform `/ready` endpoint and return the typed result. A
 * 503 response surfaces as a `ZyInsError` from `fromHttpResponse`.
 */
export async function getReadiness(ctx) {
    const response = await ctx.transport({
        url: `${ctx.baseUrl}${READINESS_PATH}`,
        method: 'GET',
        headers: { Accept: 'application/json' },
        body: '',
    });
    if (response.status >= 200 && response.status < 300) {
        return parseReadiness(response.body);
    }
    throw fromHttpResponse(response.status, response.body);
}
function parseReadiness(body) {
    if (!body) {
        throw new Error('zyins: readiness response body was empty');
    }
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('zyins: readiness response was not a JSON object');
    }
    const o = parsed;
    return {
        ready: typeof o['ready'] === 'boolean' ? o['ready'] : false,
        status: parseServingStatus(o['status']),
        db: parseProbe(o['db']),
        cache: parseProbe(o['cache']),
        downstreamServices: parseDownstreamMap(o['downstream_services']),
        checkedAt: typeof o['checked_at'] === 'string' ? o['checked_at'] : '',
    };
}
function parseProbe(value) {
    if (!value || typeof value !== 'object') {
        return { status: 'unknown', latencyMs: 0, checkedAt: '' };
    }
    const o = value;
    return {
        status: parseServingStatus(o['status']),
        latencyMs: typeof o['latency_ms'] === 'number' ? o['latency_ms'] : 0,
        message: typeof o['message'] === 'string' ? o['message'] : undefined,
        checkedAt: typeof o['checked_at'] === 'string' ? o['checked_at'] : '',
    };
}
function parseServingStatus(value) {
    return value === 'serving' || value === 'not_serving' || value === 'unknown' ? value : 'unknown';
}
function parseDownstreamMap(value) {
    if (!value || typeof value !== 'object')
        return {};
    const out = {};
    for (const [key, probe] of Object.entries(value)) {
        out[key] = parseProbe(probe);
    }
    return out;
}
//# sourceMappingURL=health.js.map