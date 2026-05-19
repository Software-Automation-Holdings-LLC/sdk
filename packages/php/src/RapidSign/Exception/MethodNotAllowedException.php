<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Exception;

/** 405 — HTTP method not allowed on this path. */
final class MethodNotAllowedException extends RapidSignException
{
    public function __construct(string $message, ?int $httpStatus = 405, ?string $requestId = null)
    {
        parent::__construct(
            message: $message,
            errorCode: 'method_not_allowed',
            httpStatus: $httpStatus,
            requestId: $requestId,
        );
    }
}
