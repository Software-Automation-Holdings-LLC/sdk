<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Cases;

/**
 * Typed response for {@see Service::create()}.
 */
final readonly class CreateResult
{
    public function __construct(
        public string $object,
        public string $hash,
        public string $url,
        public bool $readonly,
        public string $createdAt,
    ) {
    }

    /**
     * @param array<string,mixed> $data
     */
    public static function fromWire(array $data): self
    {
        return new self(
            object: is_string($data['object'] ?? null) ? (string) $data['object'] : 'case',
            hash: is_string($data['hash'] ?? null) ? (string) $data['hash'] : '',
            url: is_string($data['url'] ?? null) ? (string) $data['url'] : '',
            readonly: ($data['readonly'] ?? false) === true,
            createdAt: is_string($data['created_at'] ?? null) ? (string) $data['created_at'] : '',
        );
    }
}
