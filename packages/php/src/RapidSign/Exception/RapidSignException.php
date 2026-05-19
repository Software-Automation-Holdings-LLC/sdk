<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Exception;

use RuntimeException;
use Throwable;

/**
 * Base class for every error the RapidSign SDK emits.
 *
 * Mirrors the JS `RapidSignError` shape: callers switch on {@see code()},
 * never on HTTP status or message text. {@see requestId()} is the
 * correlation id every server response carries and is the FIRST thing
 * to copy into a support ticket.
 *
 * Specific subclasses (one per wire `code` value) extend this class;
 * `RapidSignException` itself is concrete so consumers can broad-catch.
 */
class RapidSignException extends RuntimeException
{
    public function __construct(
        string $message,
        private readonly string $errorCode,
        private readonly ?int $httpStatus = null,
        private readonly ?string $requestId = null,
        private readonly bool $retryable = false,
        private readonly ?int $retryAfterMs = null,
        private readonly ?string $param = null,
        private readonly ?string $docUrl = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    /**
     * Stable, machine-readable error code. Consumers switch on this
     * value, never on HTTP status or message text.
     */
    public function code(): string
    {
        return $this->errorCode;
    }

    public function httpStatus(): ?int
    {
        return $this->httpStatus;
    }

    public function requestId(): ?string
    {
        return $this->requestId;
    }

    public function retryable(): bool
    {
        return $this->retryable;
    }

    public function retryAfterMs(): ?int
    {
        return $this->retryAfterMs;
    }

    public function param(): ?string
    {
        return $this->param;
    }

    public function docUrl(): ?string
    {
        return $this->docUrl;
    }
}
