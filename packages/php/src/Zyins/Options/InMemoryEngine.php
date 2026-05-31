<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Options;

/**
 * In-process mock engine — bypasses HTTP entirely. Test-only.
 *
 * Reserved for future factory wiring that accepts in-process test
 * implementations without using the default network transport.
 */
final readonly class InMemoryEngine implements Engine
{
    public function kind(): string
    {
        return 'in_memory';
    }

    public function baseUrl(): string
    {
        return RemoteEngine::PRODUCTION_ORIGIN;
    }
}
