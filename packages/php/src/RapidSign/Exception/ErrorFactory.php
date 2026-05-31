<?php

declare(strict_types=1);

namespace Isa\Sdk\RapidSign\Exception;

/**
 * Parses an HTTP response into the appropriate RapidSign exception
 * subclass. Mirrors `fromHttpResponse` / `fromProblemDetails` in the JS
 * SDK; the resolution order is identical:
 *
 *   1. Body is RFC 7807 ProblemDetails → map by `code`.
 *   2. Body is non-JSON or schema-non-conforming → map by HTTP status.
 *   3. Fallback → UnknownException.
 *
 * The caller always receives a typed exception; this factory never
 * returns null for a malformed response.
 */
final class ErrorFactory
{
    private const RETRY_AFTER_SECONDS_MAX = 86_400;

    /**
     * @param array<string,string|array<int,string>> $headers Normalized header bag (lowercase keys, scalar values).
     */
    public static function fromHttpResponse(int $status, string $body, array $headers): RapidSignException
    {
        $requestId = self::headerLine($headers, 'x-request-id') ?? self::headerLine($headers, 'request-id');
        $retryAfterMs = self::parseRetryAfter(self::headerLine($headers, 'retry-after'));

        $problem = self::tryParseProblemDetails($body);
        if ($problem !== null) {
            return self::fromProblemDetails($problem, $status, $requestId, $retryAfterMs);
        }
        return self::fromHttpStatus($status, trim($body), $requestId, $retryAfterMs);
    }

    /**
     * @param array<string,mixed> $problem
     */
    private static function fromProblemDetails(array $problem, int $fallbackStatus, ?string $requestId, ?int $retryAfterMs): RapidSignException
    {
        $code = self::str($problem, 'code') ?? 'unknown';
        $status = self::int($problem, 'status') ?? $fallbackStatus;
        $message = self::str($problem, 'detail') ?? self::str($problem, 'title') ?? ('HTTP ' . $status);
        $param = self::str($problem, 'param');
        $docUrl = self::str($problem, 'doc_url');
        $resolvedRequestId = self::str($problem, 'request_id') ?? $requestId;

        return match ($code) {
            'unauthorized' => new UnauthorizedException($message, $status, $resolvedRequestId, $docUrl),
            'token_expired' => new TokenExpiredException($message, $status, $resolvedRequestId, $docUrl),
            'invalid_token' => new InvalidTokenException($message, $status, $resolvedRequestId, $docUrl),
            'forbidden' => new ForbiddenException($message, $status, $resolvedRequestId, $docUrl),
            'not_found' => new NotFoundException($message, $status, $resolvedRequestId, $docUrl),
            'method_not_allowed' => new MethodNotAllowedException($message, $status, $resolvedRequestId),
            'conflict' => new ConflictException($message, $status, $resolvedRequestId, $docUrl),
            'validation_error' => new ValidationException($message, $status, $resolvedRequestId, $param, $docUrl),
            'license_locked' => new LicenseLockedException($message, $status, $resolvedRequestId, $docUrl),
            'rate_limited', 'rate_limit_exceeded' => new RateLimitedException($message, $code, $status, $resolvedRequestId, $retryAfterMs),
            'internal_error' => new InternalErrorException($message, $status, $resolvedRequestId, $retryAfterMs),
            'bad_gateway' => new BadGatewayException($message, $status, $resolvedRequestId, $retryAfterMs),
            'gateway_timeout' => new GatewayTimeoutException($message, $status, $resolvedRequestId, $retryAfterMs),
            'service_unavailable' => new ServiceUnavailableException($message, $status, $resolvedRequestId, $retryAfterMs),
            'not_implemented' => new NotImplementedException($message, $status, $resolvedRequestId),
            default => new UnknownException($message, $status, $resolvedRequestId, $code),
        };
    }

    private static function fromHttpStatus(int $status, string $message, ?string $requestId, ?int $retryAfterMs): RapidSignException
    {
        $message = $message === '' ? ('HTTP ' . $status) : $message;
        return match ($status) {
            400 => new ValidationException($message, $status, $requestId),
            401 => new UnauthorizedException($message, $status, $requestId),
            403 => new ForbiddenException($message, $status, $requestId),
            404 => new NotFoundException($message, $status, $requestId),
            405 => new MethodNotAllowedException($message, $status, $requestId),
            409 => new ConflictException($message, $status, $requestId),
            423 => new LicenseLockedException($message, $status, $requestId),
            429 => new RateLimitedException($message, 'rate_limit_exceeded', $status, $requestId, $retryAfterMs),
            500 => new InternalErrorException($message, $status, $requestId, $retryAfterMs),
            501 => new NotImplementedException($message, $status, $requestId),
            502 => new BadGatewayException($message, $status, $requestId, $retryAfterMs),
            503 => new ServiceUnavailableException($message, $status, $requestId, $retryAfterMs),
            504 => new GatewayTimeoutException($message, $status, $requestId, $retryAfterMs),
            default => new UnknownException($message, $status, $requestId),
        };
    }

    /**
     * @return array<string,mixed>|null
     */
    private static function tryParseProblemDetails(string $body): ?array
    {
        $trimmed = ltrim($body);
        if ($trimmed === '' || ! str_starts_with($trimmed, '{')) {
            return null;
        }
        try {
            $decoded = json_decode($trimmed, associative: true, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return null;
        }
        if (! is_array($decoded)) {
            return null;
        }
        if (! self::looksLikeProblemDetails($decoded)) {
            return null;
        }
        return $decoded;
    }

    /**
     * @param array<string,mixed> $v
     */
    private static function looksLikeProblemDetails(array $v): bool
    {
        $title = $v['title'] ?? null;
        $status = $v['status'] ?? null;
        $code = $v['code'] ?? null;
        return is_string($title)
            && is_int($status)
            && $status >= 100
            && $status <= 599
            && is_string($code);
    }

    /**
     * @param array<string,mixed> $decoded
     */
    private static function str(array $decoded, string $key): ?string
    {
        $value = $decoded[$key] ?? null;
        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * @param array<string,mixed> $decoded
     */
    private static function int(array $decoded, string $key): ?int
    {
        $value = $decoded[$key] ?? null;
        return is_int($value) ? $value : null;
    }

    /**
     * @param array<string,string|array<int,string>> $headers
     */
    private static function headerLine(array $headers, string $name): ?string
    {
        $value = $headers[$name] ?? $headers[strtolower($name)] ?? null;
        if (is_array($value)) {
            $value = $value[0] ?? null;
        }
        return is_string($value) && $value !== '' ? $value : null;
    }

    private static function parseRetryAfter(?string $value): ?int
    {
        if ($value === null) {
            return null;
        }
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }
        if (ctype_digit($trimmed)) {
            $seconds = (int) $trimmed;
            if ($seconds >= 0 && $seconds <= self::RETRY_AFTER_SECONDS_MAX) {
                return $seconds * 1_000;
            }
            return null;
        }
        $epoch = strtotime($trimmed);
        if ($epoch === false) {
            return null;
        }
        $deltaMs = ($epoch - time()) * 1_000;
        if ($deltaMs <= 0) {
            return 0;
        }
        $maxMs = self::RETRY_AFTER_SECONDS_MAX * 1_000;
        return $deltaMs > $maxMs ? $maxMs : $deltaMs;
    }
}
