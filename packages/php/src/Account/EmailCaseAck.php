<?php

declare(strict_types=1);

namespace Sah\Sdk\Account;

/**
 * Acknowledgement payload returned by `cases.email`. `status` is
 * always `queued` on success.
 */
final readonly class EmailCaseAck
{
    public function __construct(
        public string $caseId,
        public string $to,
        public string $status,
    ) {
    }

    public static function fromWire(mixed $raw): self
    {
        $r = is_array($raw) ? $raw : [];
        /** @var array<string,mixed> $r */
        if (
            ! is_string($r['case_id'] ?? null)
            || ! is_string($r['to'] ?? null)
            || ! is_string($r['status'] ?? null)
        ) {
            throw new \InvalidArgumentException('account: malformed cases.email acknowledgement payload');
        }
        return new self(
            caseId: (string) $r['case_id'],
            to: (string) $r['to'],
            status: (string) $r['status'],
        );
    }
}
