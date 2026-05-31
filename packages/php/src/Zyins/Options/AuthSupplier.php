<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Options;

/**
 * Tagged auth-supplier value type accepted by {@see IsaCreateOptions}.
 *
 * Implementations: {@see BearerAuth}, {@see LicenseAuth},
 * {@see FormAuth}, {@see SessionAuth}. Each carries the credential
 * material future factory wiring needs to dispatch by concrete type.
 *
 * Mirrors the TS `IsaAuthSupplier` discriminated union and the Python
 * `IsaAuthSupplier` dataclass union exactly so consumers reading any
 * SDK see the same surface.
 */
interface AuthSupplier
{
    /**
     * Return the discriminator string. Stable per implementation:
     * `'bearer'`, `'license'`, `'form'`, `'session'`.
     */
    public function kind(): string;
}
