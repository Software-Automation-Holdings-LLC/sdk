<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Documents;

use DateTimeImmutable;

/** The packet that came back from {@see Service::send()} / {@see Service::get()}. */
final readonly class Envelope
{
    /**
     * @param array<string,string> $hashes   Source URL → SHA-256 hex actually embedded.
     * @param array<string,string> $metadata Caller metadata as supplied at send time, echoed.
     */
    public function __construct(
        public string $id,
        public string $signId,
        public string $signUrl,
        public string $viewUrl,
        public EnvelopeStatus $status,
        public Recipient $recipient,
        public array $hashes,
        public DateTimeImmutable $createdAt,
        public DateTimeImmutable $expiresAt,
        public array $metadata,
    ) {
    }
}
