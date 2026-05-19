<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Exception;

/**
 * 400 validation error.
 *
 * {@see param()} (inherited) names the offending field as a JSON
 * pointer (`/applicant/dob`) when the server narrowed the cause to a
 * single input. For multi-field validation, {@see details()} returns
 * the full per-field map.
 */
final class IsaValidationException extends IsaException
{
    /**
     * @param array<string,string> $details
     */
    public function __construct(
        string $message,
        ?int $httpStatus = null,
        ?string $requestId = null,
        ?string $param = null,
        private readonly array $details = [],
    ) {
        parent::__construct(
            message: $message,
            errorCode: 'validation_error',
            httpStatus: $httpStatus,
            requestId: $requestId,
            param: $param,
        );
    }

    /**
     * @return array<string,string>
     */
    public function details(): array
    {
        return $this->details;
    }
}
