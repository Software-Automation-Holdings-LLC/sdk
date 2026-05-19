<?php

declare(strict_types=1);

namespace Sah\Sdk\Core;

/**
 * Value object mirroring the API response envelope defined in ADR-012.
 *
 * The field names (`object`, `livemode`, `requestId`, `data`) are wire-
 * level — they map verbatim to the JSON keys the server emits, so they
 * must NOT be renamed even though the names are domain-generic. The
 * per-product SDK clients narrow `data` into a generated message type;
 * see ResponseExtractor for the unwrap helpers.
 *
 * Reference shape:
 *   {
 *     "object":     "invoice" | "payment" | ...,
 *     "livemode":   true | false,
 *     "request_id": "req_...",
 *     "data":       <resource-specific payload>
 *   }
 */
final readonly class Envelope
{
    /**
     * @param string $object     API resource type (Stripe-style; ADR-012 wire key `object`).
     * @param bool $livemode     False in test mode, true in production (ADR-012 wire key `livemode`).
     * @param string $requestId  Server-assigned correlation id (ADR-012 wire key `request_id`).
     * @param mixed $data        Resource payload — caller narrows via ResponseExtractor (ADR-012 wire key `data`).
     */
    public function __construct(
        public string $object,
        public bool $livemode,
        public string $requestId,
        public mixed $data,
    ) {
    }
}
