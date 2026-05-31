<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Options;

use InvalidArgumentException;

/**
 * Local engine — points at a developer or test endpoint.
 */
final readonly class LocalEngine implements Engine
{
    public function __construct(public string $baseUrl = 'http://localhost:8080')
    {
    }

    public function kind(): string
    {
        return 'local';
    }

    public function baseUrl(): string
    {
        return $this->baseUrl;
    }

    public static function at(string $baseUrl): self
    {
        if ($baseUrl === '') {
            throw new InvalidArgumentException(
                'LocalEngine::at: baseUrl must be a non-empty string'
            );
        }

        return new self($baseUrl);
    }
}
