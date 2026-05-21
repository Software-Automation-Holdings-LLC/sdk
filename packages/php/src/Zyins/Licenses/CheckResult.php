<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Licenses;

/**
 * Typed response from {@see Service::check()}. Mirrors the proto
 * `PublicCheckResponse` shape.
 */
final readonly class CheckResult
{
    /** @param string $status Wire value: `valid`, `invalid`, or `inactive`. */
    public function __construct(public string $status)
    {
    }

    /**
     * @param array<int|string,mixed> $data
     */
    public static function fromWire(array $data): self
    {
        $status = isset($data['status']) && is_string($data['status']) ? $data['status'] : '';
        return new self($status);
    }
}
