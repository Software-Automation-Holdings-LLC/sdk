<?php

declare(strict_types=1);

namespace Sah\Sdk\Proxy\Exception;

/**
 * 400 / 422 validation errors from the proxy.
 *
 * Surfaces the per-field details map when the proxy populates it
 * (Problem-Details `details`).
 */
final class ProxyValidationException extends ProxyException
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
        string $errorCode = 'validation_error',
        ?string $docUrl = null,
        ?string $adviceCode = null,
    ) {
        parent::__construct(
            message: $message,
            errorCode: $errorCode,
            httpStatus: $httpStatus,
            requestId: $requestId,
            adviceCode: $adviceCode,
            docUrl: $docUrl,
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
