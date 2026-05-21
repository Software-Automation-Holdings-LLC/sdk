<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Licenses;

/**
 * Auth block surfaced inside an activation response. Carries the
 * license key the server minted (or reused) for this device.
 */
final readonly class ActivateAuth
{
    public function __construct(public string $licenseKey)
    {
    }
}
