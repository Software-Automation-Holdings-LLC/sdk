<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Licenses;

use Isa\Sdk\Zyins\Exception\IsaException;

/**
 * Typed response from {@see Service::activate()}. The v2 wire shape is
 * flat — `{status, licenseKey, remainingActivations}` at the top of
 * `data` — but the public PHP surface keeps the nested
 * `result->auth->licenseKey` form so existing consumers (bpp2.0 PHP
 * bindings, integrator code) do not need to rewrite their reads.
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
        $licenseKey = $data['licenseKey'] ?? null;
        if (! is_string($licenseKey) || $licenseKey === '') {
            throw new IsaException(
                'zyins: licenses.activate response missing licenseKey field',
                'unknown',
            );
        }
        $remaining = $data['remainingActivations'] ?? null;
        if (! is_int($remaining)) {
            throw new IsaException(
                'zyins: licenses.activate response missing remainingActivations field',
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
