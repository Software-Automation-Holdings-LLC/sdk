<?php

declare(strict_types=1);

namespace Isa\Sdk\RapidSign\Exception;

/** 404 — document or sign id does not exist. */
final class NotFoundException extends RapidSignException
{
    public function __construct(string $message, ?int $httpStatus = 404, ?string $requestId = null, ?string $docUrl = null)
    {
        parent::__construct(
            message: $message,
            errorCode: 'not_found',
            httpStatus: $httpStatus,
            requestId: $requestId,
            docUrl: $docUrl,
        );
    }
}
