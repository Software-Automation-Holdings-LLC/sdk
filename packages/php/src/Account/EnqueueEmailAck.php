<?php

declare(strict_types=1);

namespace Sah\Sdk\Account;

/**
 * Acknowledgement payload returned by `email.enqueue`. `status` is
 * `queued` on success. Today the server returns a bare `{object, status}`
 * body; the SDK synthesizes this shape so callers see a stable type
 * regardless of when the server elevates to the BaseResponse envelope.
 */
final readonly class EnqueueEmailAck
{
    public function __construct(
        public string $object,
        public string $status,
    ) {
    }

    public static function fromWire(mixed $raw, string $envelopeObject): self
    {
        $r = is_array($raw) ? $raw : [];
        /** @var array<string,mixed> $r */
        if (! is_string($r['status'] ?? null) || $r['status'] === '') {
            throw new \InvalidArgumentException('account: malformed email.enqueue acknowledgement payload');
        }
        return new self(
            object: is_string($r['object'] ?? null) ? (string) $r['object'] : $envelopeObject,
            status: (string) $r['status'],
        );
    }
}
