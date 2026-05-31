<?php

declare(strict_types=1);

namespace Isa\Sdk\RapidSign\Exception;

/** 401 specifically signalled with INVALID_TOKEN. */
final class InvalidTokenException extends RapidSignException
{
    public function __construct(string $message, ?int $httpStatus = 401, ?string $requestId = null, ?string $docUrl = null)
    {
        parent::__construct(
            message: $message,
            errorCode: 'invalid_token',
            httpStatus: $httpStatus,
            requestId: $requestId,
            docUrl: $docUrl,
        );
    }
}
