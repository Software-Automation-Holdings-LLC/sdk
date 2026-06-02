<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

/**
 * A decrypted case returned by {@see CasesClient::open()}.
 */
final readonly class CaseOpenResult
{
    public function __construct(
        /** Routing tag the case was created under. */
        public string $product,
        /** The decrypted payload. */
        public mixed $payload,
    ) {
    }
}
