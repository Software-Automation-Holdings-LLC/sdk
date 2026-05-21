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

import { type AuthContext } from './auth';
import { type Transport } from './transport';
import { fromHttpResponse } from './errors';

const READINESS_PATH = '/ready';

/** Mirror of proto `ServingStatus`. Wire values are lower-case. */
export type ServingStatus = 'serving' | 'not_serving' | 'unknown';

/** Per-dependency probe outcome. */
export interface ProbeResult {
  status: ServingStatus;
  /** Observed round-trip latency in milliseconds. */
  latencyMs: number;
  /** Human-readable explanation when status is not `serving`. */
  message?: string;
  /** Wall-clock time at which this probe ran (ISO 8601). */
  checkedAt: string;
}

/** Output of `health.getReadiness`. */
export interface ReadinessResult {
  /** True iff every required sub-probe returned `serving`. */
  ready: boolean;
  /** Overall serving status mirroring `ready`. */
  status: ServingStatus;
  /** Primary dependency probe (database pool for ZyINS). */
  db: ProbeResult;
  /** Secondary dependency probe (cache). */
  cache: ProbeResult;
  /** Additional downstream probes keyed by logical service name. */
  downstreamServices: Record<string, ProbeResult>;
  /** Wall-clock time at which the evaluation ran (ISO 8601). */
  checkedAt: string;
}

/** Shared knobs the client passes through to the readiness call. */
export interface HealthContext {
  baseUrl: string;
  auth?: AuthContext;
  transport: Transport;
}

/**
 * Query the platform `/ready` endpoint and return the typed result. A
 * 503 response surfaces as a `ZyInsError` from `fromHttpResponse`.
 */
export async function getReadiness(ctx: HealthContext): Promise<ReadinessResult> {
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

function parseReadiness(body: string): ReadinessResult {
  if (!body) {
    throw new Error('zyins: readiness response body was empty');
  }
  const parsed: unknown = JSON.parse(body);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('zyins: readiness response was not a JSON object');
  }
  const o = parsed as Record<string, unknown>;
  return {
    ready: typeof o['ready'] === 'boolean' ? o['ready'] : false,
    status: parseServingStatus(o['status']),
    db: parseProbe(o['db']),
    cache: parseProbe(o['cache']),
    downstreamServices: parseDownstreamMap(o['downstream_services']),
    checkedAt: typeof o['checked_at'] === 'string' ? (o['checked_at'] as string) : '',
  };
}

function parseProbe(value: unknown): ProbeResult {
  if (!value || typeof value !== 'object') {
    return { status: 'unknown', latencyMs: 0, checkedAt: '' };
  }
  const o = value as Record<string, unknown>;
  return {
    status: parseServingStatus(o['status']),
    latencyMs: typeof o['latency_ms'] === 'number' ? (o['latency_ms'] as number) : 0,
    message: typeof o['message'] === 'string' ? (o['message'] as string) : undefined,
    checkedAt: typeof o['checked_at'] === 'string' ? (o['checked_at'] as string) : '',
  };
}

function parseServingStatus(value: unknown): ServingStatus {
  return value === 'serving' || value === 'not_serving' || value === 'unknown' ? value : 'unknown';
}

function parseDownstreamMap(value: unknown): Record<string, ProbeResult> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, ProbeResult> = {};
  for (const [key, probe] of Object.entries(value as Record<string, unknown>)) {
    out[key] = parseProbe(probe);
  }
  return out;
}
