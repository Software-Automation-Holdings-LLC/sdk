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
export {};
//# sourceMappingURL=CaseStorage.js.map