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
export declare function getReadiness(ctx: HealthContext): Promise<ReadinessResult>;
//# sourceMappingURL=health.d.ts.map