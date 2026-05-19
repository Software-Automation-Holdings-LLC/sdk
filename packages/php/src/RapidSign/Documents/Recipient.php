<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Documents;

/** Recipient (a single signer; v1 is one-signer-per-doc). */
final readonly class Recipient
{
    public function __construct(
        public string $email,
        public ?string $name = null,
    ) {
    }
}
