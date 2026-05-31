/**
 * Signed-request dispatch for the `/v1/case` operations. Centralizes the
 * License-HMAC header construction + transport call so each operation in
 * `cases.ts` only assembles its body and routes status codes.
 */
import { type AuthContext } from './auth.js';
import { type Transport } from '../zyins/transport.js';
import { type Clock } from '../core/index.js';
/** The auth + transport context a signed case request needs. */
export interface TCaseRequestContext {
    baseUrl: string;
    auth: AuthContext;
    transport: Transport;
    clock: Clock;
    idempotencyKey?: string;
}
/** A single signed `/v1/case` request: method, path, body, and idempotency. */
export interface TSignedRequestSpec {
    method: 'GET' | 'POST';
    path: string;
    body: string;
    /** When set, an `Idempotency-Key` is derived (or taken from ctx) for the op. */
    idempotencyOp?: string;
}
/** Shape of a transport response after success/error status routing. */
export type TTransportResponse = Awaited<ReturnType<Transport>>;
/**
 * Build License-HMAC headers and dispatch one `/v1/case` request, eliminating
 * the per-operation header/transport boilerplate. The caller routes status
 * codes — this helper only signs and sends.
 */
export declare function signedCaseRequest(spec: TSignedRequestSpec, ctx: TCaseRequestContext): Promise<TTransportResponse>;
/** True when an HTTP status is a 2xx success. */
export declare function isSuccess(status: number): boolean;
//# sourceMappingURL=caseTransport.d.ts.map