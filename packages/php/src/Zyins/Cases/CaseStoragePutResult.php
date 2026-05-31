<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Cases;

/**
 * Result of {@see CaseStorage::put()}.
 *
 * Adapters that mint a fragment key (the default zero-knowledge path)
 * return it as `$recallToken`; adapters with no client-side key
 * material omit the field (`null`).
 *
 * Consumers thread `$recallToken` through unchanged — adapters treat
 * it as opaque.
 *
 * Mirrors the TS `CaseStoragePutResult` lock (see
 * `packages/ts/src/zyins/cases/CaseStorage.ts`).
 */
final readonly class CaseStoragePutResult
{
    /**
     * @param string      $id           Adapter-assigned opaque identifier.
     * @param string|null $recallToken  Opaque material required by
     *     {@see CaseStorage::get()} to recover the record. `null` when
     *     the adapter requires no client-side material.
     */
    public function __construct(
        public string $id,
        public ?string $recallToken = null,
    ) {
    }
}
