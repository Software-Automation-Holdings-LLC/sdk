/**
 * `isa.account.referenceData` — engine reference data lookups.
 *
 * Three wire paths, one typed surface:
 *
 *   scope === 'dataset'           → `GET   /dataset/{dataset}`
 *   scope === 'compiled_data_v2'  → `POST  /v1/reference-data`
 *   scope === 'compiled_data_v3'  → `POST  /v2/reference-data`
 *   (other scope values)          → `POST  /v1/reference-data`
 *
 * The scope value is forwarded to the server in the request body for the
 * POST paths so the server can dispatch to the right compiled-data version.
 * For the GET path the `dataset` field selects the dataset by name; no body
 * is sent.
 *
 * Return shape is the server's verbatim JSON, unwrapped from the standard
 * `{ data: ... }` envelope when present. The common case is
 * `{ datasets: { ... } }`; some endpoints return a flat record. The SDK
 * does not interpret the payload — callers pick the fields they need.
 */
import { type AuthContext } from './auth';
import { type Transport } from '../zyins/transport';
import { type Clock } from '../core';
/** Inputs for `account.referenceData.get`. */
export interface ReferenceDataRequest {
    /**
     * Server-side dispatcher key. `'dataset'` routes to `GET /dataset/{name}`.
     * `'compiled_data_v2'` routes to `POST /v1/reference-data`.
     * `'compiled_data_v3'` routes to `POST /v2/reference-data`. Other values
     * default to `/v1/reference-data` for forward compatibility.
     */
    scope: string;
    /** Required when `scope === 'dataset'`. Names the dataset to fetch. */
    dataset?: string;
    /** Optional caller-supplied filters / parameters; forwarded as the POST body. */
    payload?: Record<string, unknown>;
}
/**
 * Response shape — opaque to the SDK. Common case is
 * `{ datasets: { name1: [...], name2: {...}, ... } }`; some scopes return
 * a flat record. Callers down-cast.
 */
export type ReferenceDataResult = Record<string, unknown>;
export interface ReferenceDataContext {
    baseUrl: string;
    auth: AuthContext;
    transport: Transport;
    clock: Clock;
}
/** Fetch reference data per the supplied scope. */
export declare function get(request: ReferenceDataRequest, ctx: ReferenceDataContext): Promise<ReferenceDataResult>;
//# sourceMappingURL=referenceData.d.ts.map