<?php

declare(strict_types=1);

namespace Sah\Sdk\Proxy\Exception;

use RuntimeException;
use Throwable;

/**
 * Base class for every error the proxy SDK emits.
 *
 * Mirrors the JS `ProxyError` shape: callers switch on {@see code()},
 * never on HTTP status or message text. {@see requestId()} is the
 * correlation id every server response carries and is the FIRST thing
 * to copy into a support ticket.
 */
class IsaException extends RuntimeException
{
    public function __construct(
        string $message,
        private readonly string $errorCode,
        private readonly ?int $httpStatus = null,
        private readonly ?string $requestId = null,
        private readonly ?string $adviceCode = null,
        private readonly ?string $docUrl = null,
        private readonly ?string $param = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    /**
     * Stable, machine-readable error code. Consumers switch on this
     * value, never on HTTP status or message text.
     *
     * NOTE: this is intentionally not named `code()` because PHP's
     * built-in {@see \Exception::getCode()} returns an int.
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

    public function adviceCode(): ?string
    {
        return $this->adviceCode;
    }

    public function docUrl(): ?string
    {
        return $this->docUrl;
    }

    public function param(): ?string
    {
        return $this->param;
    }
}
