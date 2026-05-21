/**
 * Tier 3 cases operations — `POST /v1/case`.
 *
 * Cases are content-addressed shareable artifacts created from a quote
 * input + results + selected products. The server hashes the (xml,
 * results, products) tuple — identical inputs dedupe to the same `hash`
 * regardless of which license created the case. ZIP+4 fields are stripped
 * from the input before hashing.
 *
 * Today this module exposes `create`; the existing `case.email` Tier-3
 * helper is re-exported via the `cases` sub-client for case-share email.
 * Future `list` / `get` / `delete` RPCs require new server work (see the
 * design doc; tracked as issue #149 follow-ups).
 */
import { type AuthContext } from './auth';
import { type Transport } from './transport';
import { type Clock } from '../core';
/**
 * Inputs for `cases.create`. The `input` field is polymorphic at the wire:
 * a JSON object is converted to XML server-side; a raw XML string passes
 * through as-is.
 */
export interface CaseCreateRequest {
    input: Record<string, unknown> | string;
    results?: unknown;
    products?: string[];
}
export interface CaseCreateResult {
    object: string;
    hash: string;
    url: string;
    readonly: boolean;
    createdAt: string;
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
//# sourceMappingURL=cases.d.ts.map