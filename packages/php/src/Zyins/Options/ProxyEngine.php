<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Options;

use InvalidArgumentException;

/**
 * Routes through the platform proxy.
 *
 * The underlying ZyINS request still targets {@see RemoteEngine::PRODUCTION_ORIGIN};
 * `proxyOrigin` is consumed by the proxy namespace.
 */
final readonly class ProxyEngine implements Engine
{
    /** Production proxy endpoint origin. */
    public const PRODUCTION_ORIGIN = 'https://proxy.isaapi.com';

    public function __construct(public string $proxyOrigin = self::PRODUCTION_ORIGIN)
    {
    }

    public function kind(): string
    {
        return 'proxy';
    }

    public function baseUrl(): string
    {
        return RemoteEngine::PRODUCTION_ORIGIN;
    }

    public static function default(): self
    {
        return new self(self::PRODUCTION_ORIGIN);
    }

    public static function at(string $proxyOrigin): self
    {
        if ($proxyOrigin === '') {
            throw new InvalidArgumentException(
                'ProxyEngine::at: proxyOrigin must be a non-empty string'
            );
        }

        return new self($proxyOrigin);
    }
}
