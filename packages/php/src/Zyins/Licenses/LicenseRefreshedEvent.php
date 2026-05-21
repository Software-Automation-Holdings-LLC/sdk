<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Licenses;

/**
 * Event payload fired when the SDK observes a fresh license key —
 * typically the return value of `licenses->activate()`. Subscribe via
 * {@see \Sah\Sdk\Isa::onLicenseRefreshed()} to wire React-Query
 * invalidation, analytics, or UI banners.
 */
final readonly class LicenseRefreshedEvent
{
    public function __construct(
        public string $licenseKey,
        public string $deviceId,
        public string $email,
        public string $orderId,
    ) {
    }
}
