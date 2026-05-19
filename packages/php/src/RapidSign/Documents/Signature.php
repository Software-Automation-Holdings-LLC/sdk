<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Documents;

use DateTimeImmutable;

/** The signature that came back from {@see Service::awaitSignature()} / {@see Service::get()} after signing. */
final readonly class Signature
{
    /**
     * @param string               $signature Decoded signature image bytes (binary string).
     * @param array<string,string> $metadata  Free-form audit metadata stored at signing time.
     */
    public function __construct(
        public string $signId,
        public string $signature,
        public DateTimeImmutable $signedAt,
        public string $signerIp,
        public string $userAgent,
        public array $metadata,
    ) {
    }
}
