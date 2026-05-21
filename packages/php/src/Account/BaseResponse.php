<?php

declare(strict_types=1);

namespace Sah\Sdk\Account;

/**
 * BaseResponse envelope wrapping every successful `isa.account.*`
 * response. Mirrors CONTRACT C13 — the same five fields the TS, Go,
 * and Python SDKs surface so callers can switch between languages
 * without re-learning the shape.
 *
 * `idempotencyKey` is documented but stub handlers do not populate it
 * everywhere; missing values surface as the empty string to keep the
 * shape stable.
 *
 * The `data` field is `mixed` at the envelope level — each per-resource
 * client narrows it to its typed value object via a dedicated
 * `fromWire()` factory before returning to the caller.
 */
final readonly class BaseResponse
{
    public function __construct(
        public string $object,
        public bool $livemode,
        public string $requestId,
        public string $idempotencyKey,
        public mixed $data,
    ) {
    }
}
