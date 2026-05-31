<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Cases;

/**
 * Pluggable case storage adapter.
 *
 * The {@see \Isa\Sdk\Zyins\ZyInsClient} resolves a single implementation
 * at construction time and routes every `isa->zyins->cases->save()` and
 * `recall()` call through it. Default: {@see ZeroKnowledgeCaseStorage} —
 * preserves the ISA platform's E2EE Phase 2 guarantee (ciphertext on the
 * wire, key in the share-link fragment, server cannot decrypt).
 *
 * Carrier adapters (Mountain Life, William Penn, …) may substitute
 * their own storage — typically because the carrier hosts the canonical
 * record and the share link is a redirect into the carrier's portal.
 *
 * Adapters MUST treat `$recallToken` as opaque. The default returns a
 * base64url AES-256-GCM data key; a carrier may return a signed bearer
 * token, an SSO handoff blob, or omit the token entirely. Consumers
 * thread it through unchanged.
 *
 * Implementations MUST be safe to call concurrently and MUST NOT mutate
 * arguments. Failure modes throw — never return a partial record.
 *
 * Mirrors the TS `CaseStorage` lock (see
 * `packages/ts/src/zyins/cases/CaseStorage.ts`) and the locked design
 * doc `docs/sdk-syntax-proposal.md` §2.9.
 *
 * @example Default zero-knowledge path
 *     $isa = ZyInsClient::withBearer();          // no caseStorage override
 *     $result = $isa->zyins->cases->save(new CaseRecord(
 *         product: 'zyins',
 *         payload: $payload,
 *     ));
 *     $record = $isa->zyins->cases->recall($result->id, $result->recallToken);
 *
 * @example Carrier override
 *     $isa = new ZyInsClient(
 *         token: $token,
 *         caseStorage: new MountainLifeCaseStorage($carrierClient),
 *     );
 *     // Same call sites; the carrier's portal now hosts the record.
 */
interface CaseStorage
{
    /**
     * Persist a case record. Returns the adapter's identifier plus an
     * optional opaque recall token. The token, if present, is required
     * for {@see get()} — store it alongside the id (or carry it in the
     * share-link fragment for E2EE adapters).
     */
    public function put(CaseRecord $record): CaseStoragePutResult;

    /**
     * Resolve a previously-stored record. `$recallToken` is required
     * iff the adapter returned one from {@see put()}; passing it when
     * not required is a no-op. Returns `null` when the record is absent
     * (expired, deleted, or never existed — adapters do not distinguish
     * these by design).
     */
    public function get(string $id, ?string $recallToken = null): ?CaseRecord;
}
