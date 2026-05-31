<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Cases;

/**
 * Application-level record handed to {@see CaseStorage::put()} and
 * returned from {@see CaseStorage::get()}.
 *
 * Product-agnostic: adapters layer their own routing on top of
 * `$product` (the cleartext app tag — `'zyins'`, `'eapp'`,
 * `'rapidsign'`, or a carrier-defined value). The `$payload` is
 * arbitrary JSON-serializable data; the default
 * {@see ZeroKnowledgeCaseStorage} encrypts it client-side before the
 * wire call.
 *
 * Mirrors the TS `CaseRecord` lock (see
 * `packages/ts/src/zyins/cases/CaseStorage.ts`).
 */
final readonly class CaseRecord
{
    /**
     * @param string $product Cleartext routing tag identifying the app
     *     that owns the payload.
     * @param mixed  $payload Arbitrary JSON-serializable payload.
     */
    public function __construct(
        public string $product,
        public mixed $payload,
    ) {
    }
}
