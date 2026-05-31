<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Options;

use InvalidArgumentException;

/**
 * Production (or staging) ZyINS endpoint engine selector.
 */
final readonly class RemoteEngine implements Engine
{
    /** Production ZyINS endpoint origin. */
    public const PRODUCTION_ORIGIN = 'https://zyins.isaapi.com';

    public function __construct(public string $baseUrl = self::PRODUCTION_ORIGIN)
    {
    }

    public function kind(): string
    {
        return 'remote';
    }

    public function baseUrl(): string
    {
        return $this->baseUrl;
    }

    /** Default — production endpoint. */
    public static function default(): self
    {
        return new self(self::PRODUCTION_ORIGIN);
    }

    /** Construct from an explicit base URL (staging, region-specific). */
    public static function at(string $baseUrl): self
    {
        if ($baseUrl === '') {
            throw new InvalidArgumentException(
                'RemoteEngine::at: baseUrl must be a non-empty string'
            );
        }

        return new self($baseUrl);
    }
}
