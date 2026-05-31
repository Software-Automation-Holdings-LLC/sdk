<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Exception;

use DateTimeImmutable;
use Throwable;

/**
 * Thrown when the server rejects a POST with HTTP 409 because the same
 * `Idempotency-Key` was previously used with a different request body.
 *
 * Catches the queued-write bug class where a worker reuses an
 * idempotency key after mutating the payload between attempts.
 *
 * The matching code is the stable identifier — never match on message
 * text:
 *
 *     try {
 *         $client->cases->create($input, $opts);
 *     } catch (IsaIdempotencyConflictException $e) {
 *         $logger->error('idempotency conflict', [
 *             'key'           => $e->getKey(),
 *             'first_seen_at' => $e->getFirstSeenAt()?->format(DATE_RFC3339),
 *         ]);
 *     }
 */
final class IsaIdempotencyConflictException extends IsaException
{
    public const CODE = 'idempotency_conflict';
    public const STATUS = 409;

    public function __construct(
        string $message,
        private readonly string $key,
        private readonly ?DateTimeImmutable $firstSeenAt = null,
        ?string $requestId = null,
        ?string $docUrl = null,
        ?string $adviceCode = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct(
            message: $message,
            errorCode: self::CODE,
            httpStatus: self::STATUS,
            requestId: $requestId,
            adviceCode: $adviceCode,
            docUrl: $docUrl,
            previous: $previous,
        );
    }

    /** The idempotency key the caller sent that collided. */
    public function getKey(): string
    {
        return $this->key;
    }

    /**
     * When the server first observed this key, if the response included
     * the `first_seen_at` extension. Null when the server omits the
     * field (older deployments).
     */
    public function getFirstSeenAt(): ?DateTimeImmutable
    {
        return $this->firstSeenAt;
    }
}
