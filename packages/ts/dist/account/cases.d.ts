/**
 * `isa.account.cases` — case CRUD + share over `/v1/case`.
 *
 *   create  → `POST   /v1/case`
 *   get     → `GET    /v1/case/{id}`
 *   list    → `GET    /v1/case`
 *   email   → `POST   /v1/case/{id}/email`
 *
 * Cases are content-addressed shareable artifacts created from a quote
 * input + results + selected products. The server hashes the tuple —
 * identical inputs dedupe to the same `hash` regardless of which license
 * created the case.
 */
import { type AuthContext } from './auth';
import { type Transport } from '../zyins/transport';
import { type Clock } from '../core';
/** Inputs for `account.cases.create`. */
export interface CaseCreateRequest {
    /** Quote input — object converted to XML server-side, or raw XML string. */
    input: Record<string, unknown> | string;
    /** Optional quote results payload. */
    results?: unknown;
    /** Optional product selection (array of product identifiers). */
    products?: string[];
}
export interface CaseCreateResult {
    /** Content-addressed case identifier. */
    hash: string;
    /** Absolute share URL for the case viewer. */
    url: string;
    /** True when the case is read-only (created by another license). */
    readonly: boolean;
    /** RFC 3339 timestamp the case was first created. */
    createdAt: string;
}
/** A case as returned by `get` / `list`. */
export interface CaseSummary {
    hash: string;
    url: string;
    readonly: boolean;
    createdAt: string;
    /** Optional original input (server returns when caller owns the case). */
    input?: unknown;
    /** Optional results payload (server returns when present). */
    results?: unknown;
    /** Optional product selection (server returns when present). */
    products?: string[];
}
/** Inputs for `account.cases.email`. */
export interface CaseEmailRequest {
    caseId: string;
    to: string;
}
export interface CaseEmailResult {
    queued: true;
}
export interface CasesContext {
    baseUrl: string;
    auth: AuthContext;
    transport: Transport;
    clock: Clock;
    idempotencyKey?: string;
}
/** Create a new shareable case. */
export declare function create(request: CaseCreateRequest, ctx: CasesContext): Promise<CaseCreateResult>;
/** Retrieve a single case by hash. */
export declare function get(caseId: string, ctx: CasesContext): Promise<CaseSummary>;
/** List all cases visible to the caller. */
export declare function list(ctx: CasesContext): Promise<CaseSummary[]>;
/** Email a case PDF / artifact to a recipient. */
export declare function email(request: CaseEmailRequest, ctx: CasesContext): Promise<CaseEmailResult>;
//# sourceMappingURL=cases.d.ts.map