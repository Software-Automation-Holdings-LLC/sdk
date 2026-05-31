<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

/**
 * Resource shape carried inside `data` for single-case responses.
 */
final readonly class CaseDetail
{
    public function __construct(
        public string $caseId,
        public string $url,
        public bool $readonly,
        public string $createdAt,
        public mixed $body,
    ) {
    }

    public static function fromWire(mixed $raw): self
    {
        $r = is_array($raw) ? $raw : [];
        /** @var array<string,mixed> $r */
        return new self(
            caseId: is_string($r['case_id'] ?? null) ? (string) $r['case_id'] : '',
            url: is_string($r['url'] ?? null) ? (string) $r['url'] : '',
            readonly: is_bool($r['readonly'] ?? null) ? (bool) $r['readonly'] : false,
            createdAt: is_string($r['created_at'] ?? null) ? (string) $r['created_at'] : '',
            body: $r['body'] ?? null,
        );
    }
}
