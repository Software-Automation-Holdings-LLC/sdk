<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

/**
 * Envelope for `cases.list` carries `data: CaseDetail[]` plus a
 * `hasMore` flag for cursor pagination.
 */
final readonly class CasesListEnvelope
{
    /**
     * @param CaseDetail[] $data
     */
    public function __construct(
        public string $object,
        public bool $livemode,
        public string $requestId,
        public string $idempotencyKey,
        public array $data,
        public bool $hasMore,
    ) {
    }
}
