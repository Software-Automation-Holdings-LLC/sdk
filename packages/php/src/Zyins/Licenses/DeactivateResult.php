<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Licenses;

/**
 * Typed response from {@see Service::deactivate()}. Mirrors the proto
 * `PublicDeactivateResponse` shape.
 */
final readonly class DeactivateResult
{
    /** @param string $status Always `deactivated` on success. */
    public function __construct(public string $status)
    {
    }

    /**
     * @param array<int|string,mixed> $data
     */
    public static function fromWire(array $data): self
    {
        $status = isset($data['status']) && is_string($data['status']) ? $data['status'] : 'deactivated';
        return new self($status);
    }
}
