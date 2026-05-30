/**
 * `CaseStorage` — pluggable adapter for the case share/recall pipeline.
 *
 * The default implementation ({@link ZeroKnowledgeCaseStorage}) preserves
 * the ISA platform's E2EE Phase 2 guarantee: ciphertext on the wire, key
 * in the share-link fragment, server cannot decrypt. Carrier adapters
 * (Mountain Life, William Penn, …) may substitute their own storage —
 * typically because the carrier hosts the canonical record and the share
 * link is a redirect into the carrier's portal.
 *
 * Adapters MUST treat `recallToken` as opaque. The default returns a
 * base64url AES-256-GCM data key; a carrier may return a signed bearer
 * token, an SSO handoff blob, or omit the token entirely. Consumers
 * thread it through unchanged.
 *
 * @see docs/sdk-syntax-proposal.md §2.9 (CaseStorage adapter lock)
 */

/**
 * The application-level record handed to `CaseStorage.put` and returned
 * from `CaseStorage.get`. Product-agnostic; adapters layer their own
 * routing on top of `product` (the cleartext app tag).
 */
export interface CaseRecord {
  /**
   * Cleartext routing tag identifying the app that owns the payload
   * (`'zyins'`, `'eapp'`, `'rapidsign'`, or a carrier-defined value).
   * Mirrors {@link import('../../account/cases').TCaseProduct}.
   */
  product: string;
  /**
   * Arbitrary JSON payload. The default `ZeroKnowledgeCaseStorage`
   * encrypts this client-side before the wire call; alternate adapters
   * may forward it directly to a carrier-owned store.
   */
  payload: unknown;
}

/**
 * Result of {@link CaseStorage.put}. Adapters that mint a fragment key
 * (the default zero-knowledge path) return it as `recallToken`; adapters
 * with no client-side key material omit the field.
 */
export interface CaseStoragePutResult {
  /** Server-assigned (or adapter-assigned) opaque identifier. */
  id: string;
  /**
   * Opaque material the recipient needs to recover the record. The
   * default implementation returns a base64url AES-256-GCM data key
   * intended for a share-link fragment (`#k=…`); carrier adapters may
   * return a signed bearer token, an SSO handoff blob, or omit the
   * field when no client-side material is required.
   */
  recallToken?: string;
}

/**
 * Pluggable case storage adapter. The Isa instance resolves a single
 * implementation at construction time and routes every `isa.zyins.cases`
 * operation through it.
 *
 * Implementations MUST be safe to call concurrently and MUST NOT mutate
 * arguments. Failure modes throw — never return a partial record.
 *
 * @example Default zero-knowledge path
 * ```ts
 * const isa = await Isa.create({ auth, /* no caseStorage *\/ });
 * const { id, recallToken } = await isa.zyins.cases.save({
 *   product: 'zyins', payload,
 * });
 * // Reuse recallToken to share or recall:
 * const record = await isa.zyins.cases.recall(id, recallToken);
 * ```
 *
 * @example Carrier override
 * ```ts
 * const isa = await Isa.create({
 *   auth,
 *   caseStorage: new MountainLifeCaseStorage(carrierClient),
 * });
 * // Same call sites; the carrier's portal now hosts the record.
 * ```
 */
export interface CaseStorage {
  /**
   * Persist a case record. Returns the adapter's identifier plus an
   * optional opaque recall token. The token, if present, is required
   * for {@link get} — store it alongside the id (or carry it in the
   * share-link fragment for E2EE adapters).
   */
  put(record: CaseRecord): Promise<CaseStoragePutResult>;

  /**
   * Resolve a previously-stored record. `recallToken` is required iff
   * the adapter returned one from {@link put}; passing it when not
   * required is a no-op. Returns `null` when the record is absent
   * (expired, deleted, or never existed — adapters do not distinguish
   * these by design).
   */
  get(id: string, recallToken?: string): Promise<CaseRecord | null>;

  /**
   * Delete a record by id. Optional — adapters whose storage is
   * write-once or carrier-managed may omit this method, in which case
   * `isa.zyins.cases.delete()` will throw at call-time.
   */
  delete?(id: string): Promise<void>;
}
