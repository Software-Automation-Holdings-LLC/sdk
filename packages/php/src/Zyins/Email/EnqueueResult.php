<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Email;

/**
 * Typed response for {@see Service::enqueue()}.
 */
final readonly class EnqueueResult
{
    public function __construct(public string $enqueueId)
    {
    }

    /**
     * @param array<string,mixed> $data
     */
    public static function fromWire(array $data): self
    {
        $id = $data['enqueue_id'] ?? '';
        return new self(is_string($id) ? $id : '');
    }
}
