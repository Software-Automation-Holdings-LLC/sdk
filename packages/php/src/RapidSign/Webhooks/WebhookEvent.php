<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Webhooks;

use DateTimeImmutable;

/**
 * Decoded webhook event. The concrete payload shape lands with the
 * server (issue #38); the SDK ships the value type today so consumers
 * write against the final shape.
 */
final readonly class WebhookEvent
{
    public function __construct(
        public string $id,
        public string $type,
        public DateTimeImmutable $createdAt,
        public mixed $data,
    ) {
    }
}
