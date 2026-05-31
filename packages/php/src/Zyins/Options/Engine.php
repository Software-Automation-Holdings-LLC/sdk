<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Options;

/**
 * Tagged engine-selector value type accepted by {@see IsaCreateOptions}.
 *
 * Implementations: {@see RemoteEngine}, {@see LocalEngine},
 * {@see ProxyEngine}, {@see InMemoryEngine}. Each maps to a base URL
 * (and proxy origin where applicable) consumed by
 * {@see ResolvedIsaOptions::resolve()}.
 */
interface Engine
{
    /**
     * Return the discriminator string. Stable per implementation:
     * `'remote'`, `'local'`, `'proxy'`, `'in_memory'`.
     */
    public function kind(): string;

    /**
     * Return the base URL the underlying ZyINS request targets.
     */
    public function baseUrl(): string;
}
