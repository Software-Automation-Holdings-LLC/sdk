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

import { encryptCase, decryptCase } from '../../account/caseCrypto';
import {
  parseCreatedId,
  parseCaseDetail,
} from '../../account/caseWire';
import {
  signedCaseRequest,
  isSuccess,
  type TCaseRequestContext,
} from '../../account/caseTransport';
import { fromHttpResponse } from '../errors';
import type { CaseRecord, CaseStorage, CaseStoragePutResult } from './CaseStorage';

/** Wire path for the opaque case store. Versioned by the `cases` surface. */
const CASE_PATH = '/v1/case';
/** HTTP status that maps to a `null` record on recall (absent / expired). */
const HTTP_NOT_FOUND = 404;

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
export class ZeroKnowledgeCaseStorage implements CaseStorage {
  constructor(private readonly contextOnce: () => ZeroKnowledgeCaseStorageContext) {}

  async put(record: CaseRecord): Promise<CaseStoragePutResult> {
    if (!record || typeof record.product !== 'string' || record.product.length === 0) {
      throw new Error('ZeroKnowledgeCaseStorage: put requires a non-empty product');
    }
    if (record.payload === undefined) {
      throw new Error('ZeroKnowledgeCaseStorage: put requires a payload');
    }
    const ctx = this.contextOnce();
    const { envelope, keyFragment } = await encryptCase(record.product, record.payload);
    const body = JSON.stringify({ product: record.product, ...envelope });
    const response = await signedCaseRequest(
      { method: 'POST', path: CASE_PATH, body, idempotencyOp: 'cases_create' },
      ctx,
    );
    if (!isSuccess(response.status)) {
      throw fromHttpResponse(response.status, response.body);
    }
    const id = parseCreatedId(response.body);
    return { id, recallToken: keyFragment };
  }

  async get(id: string, recallToken?: string): Promise<CaseRecord | null> {
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('ZeroKnowledgeCaseStorage: get requires a non-empty id');
    }
    if (typeof recallToken !== 'string' || recallToken.length === 0) {
      throw new Error(
        'ZeroKnowledgeCaseStorage: get requires the recallToken returned from put — ' +
          'records are opaque ciphertext without the per-record key',
      );
    }
    const ctx = this.contextOnce();
    const path = `${CASE_PATH}/${encodeURIComponent(id)}`;
    const response = await signedCaseRequest({ method: 'GET', path, body: '' }, ctx);
    if (response.status === HTTP_NOT_FOUND) return null;
    if (!isSuccess(response.status)) {
      throw fromHttpResponse(response.status, response.body);
    }
    const { product, envelope } = parseCaseDetail(response.body);
    const payload = await decryptCase(product, envelope, recallToken);
    return { product, payload };
  }
}
