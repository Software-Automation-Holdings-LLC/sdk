/**
 * `ZeroKnowledgeCaseStorage` — the default {@link CaseStorage} adapter.
 *
 * Preserves the ISA platform's E2EE Phase 2 guarantee: the SDK generates a
 * fresh 256-bit AES-GCM key per record, encrypts the payload client-side
 * (with `product` bound as AEAD additional data), posts only the opaque
 * envelope to `/v1/case`, and returns the key as `recallToken` (base64url)
 * — the server never holds key material.
 *
 * Recall reverses the flow: fetch the opaque envelope, decrypt with the
 * caller-supplied `recallToken`. A 404 (absent / expired — by design
 * indistinguishable) surfaces as `null`.
 *
 * Implementation reuses the shipped crypto + wire helpers from `#347`
 * (`encryptCase` / `decryptCase` / `signedCaseRequest`) to avoid forking
 * the cryptographic surface.
 */
import { type TCaseRequestContext } from '../../account/caseTransport';
import type { CaseRecord, CaseStorage, CaseStoragePutResult } from './CaseStorage';
/**
 * Per-operation context needed by the default zero-knowledge adapter.
 * Mirrors {@link import('../../account/cases').CasesContext} without the
 * viewer-origin field — share-link assembly is the consumer's call,
 * not the adapter's.
 */
export type ZeroKnowledgeCaseStorageContext = TCaseRequestContext;
/**
 * Default zero-knowledge implementation of {@link CaseStorage}. Constructed
 * with the same signed-request context the legacy `account.cases` surface
 * uses; the parent `Isa` wires this automatically when no override is
 * supplied on {@link import('../isaOptions').IsaCreateOptions.caseStorage}.
 */
export declare class ZeroKnowledgeCaseStorage implements CaseStorage {
    private readonly contextOnce;
    constructor(contextOnce: () => ZeroKnowledgeCaseStorageContext);
    put(record: CaseRecord): Promise<CaseStoragePutResult>;
    get(id: string, recallToken?: string): Promise<CaseRecord | null>;
}
//# sourceMappingURL=ZeroKnowledgeCaseStorage.d.ts.map