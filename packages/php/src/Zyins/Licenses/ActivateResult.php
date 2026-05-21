<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Licenses;

use Sah\Sdk\Zyins\Exception\IsaException;

/**
 * Typed response from {@see Service::activate()}. Mirrors the proto
 * `PublicActivateResponse` shape.
 */
final readonly class ActivateResult
{
    public function __construct(
        public string $status,
        public ActivateAuth $auth,
        public int $remainingActivations,
    ) {
    }

    /**
     * @param array<int|string,mixed> $data
     */
    public static function fromWire(array $data): self
    {
        $status = isset($data['status']) && is_string($data['status']) ? $data['status'] : '';
        if ($status === '') {
            throw new IsaException(
                'zyins: licenses.activate response missing status field',
                'unknown',
            );
        }
        $remaining = $data['remaining_activations'] ?? null;
        if (! is_int($remaining)) {
            throw new IsaException(
                'zyins: licenses.activate response missing remaining_activations',
                'unknown',
            );
        }
        $rawAuth = $data['auth'] ?? null;
        if (! is_array($rawAuth)) {
            throw new IsaException(
                'zyins: licenses.activate response missing auth block',
                'unknown',
            );
        }
        $licenseKey = $rawAuth['license_key'] ?? null;
        if (! is_string($licenseKey) || $licenseKey === '') {
            throw new IsaException(
                'zyins: licenses.activate response missing auth.license_key',
                'unknown',
            );
        }
        return new self(
            status: $status,
            auth: new ActivateAuth($licenseKey),
            remainingActivations: $remaining,
        );
    }
}
