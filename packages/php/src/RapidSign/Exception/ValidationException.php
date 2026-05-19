<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Exception;

/**
 * 400 — request body failed schema/domain validation.
 *
 * {@see param()} (inherited) names the offending field. Construction is
 * permitted client-side too, when the SDK rejects input before the wire.
 */
final class ValidationException extends RapidSignException
{
    public function __construct(
        string $message,
        ?int $httpStatus = 400,
        ?string $requestId = null,
        ?string $param = null,
        ?string $docUrl = null,
    ) {
        parent::__construct(
            message: $message,
            errorCode: 'validation_error',
            httpStatus: $httpStatus,
            requestId: $requestId,
            param: $param,
            docUrl: $docUrl,
        );
    }
}
