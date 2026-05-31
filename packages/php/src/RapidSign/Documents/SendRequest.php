<?php

declare(strict_types=1);

namespace Isa\Sdk\RapidSign\Documents;

/**
 * Inputs accepted by {@see Service::send()}.
 *
 * `expiresIn` accepts the same forms as the JS SDK: an ISO-8601 duration
 * (e.g. `P30D`), a shorthand string (`5m`, `2h`, `7d`), or an integer
 * millisecond count. Omitting it defers to the server default TTL.
 */
final readonly class SendRequest
{
    /**
     * @param list<PdfSource>      $packet         Ordered PDF sources merged into the packet.
     * @param array<string,string> $metadata       Caller-defined metadata stored verbatim (≤ 64 keys).
     * @param string|int|null      $expiresIn      ISO-8601 duration, shorthand string, or milliseconds.
     */
    public function __construct(
        public array $packet,
        public Recipient $recipient,
        public ?string $legalText = null,
        public array $metadata = [],
        public string|int|null $expiresIn = null,
        public ?string $notificationKey = null,
        public ?string $idempotencyKey = null,
    ) {
    }
}
