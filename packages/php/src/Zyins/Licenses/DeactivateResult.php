<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Licenses;

use Isa\Sdk\Zyins\Exception\IsaException;

/**
 * Typed response from {@see Service::deactivate()}. The v2 wire word
 * is `inactive`; legacy servers may still return `deactivated`. Both
 * are surfaced to the caller as-is so consumers can match on the
 * value they expect from their pinned server version.
 */
final readonly class DeactivateResult
{
    /** @param string $status `inactive` on v2 success; `deactivated` on legacy success. */
    public function __construct(
        public string $status,
        public ?int $remainingActivations = null,
    ) {
    }

    /**
     * @param array<int|string,mixed> $data
     */
    public static function fromWire(array $data): self
    {
        $status = $data['status'] ?? null;
        if (! is_string($status) || $status === '') {
            throw new IsaException(
                'zyins: licenses.deactivate response missing status field',
                'unknown',
            );
        }
        $remaining = isset($data['remainingActivations']) && is_int($data['remainingActivations'])
            ? $data['remainingActivations']
            : null;
        return new self($status, $remaining);
    }
}
