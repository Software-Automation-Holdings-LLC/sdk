<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

use DateTimeImmutable;
use GuzzleHttp\Psr7\Request;
use Psr\Http\Client\ClientExceptionInterface;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\ResponseInterface;
use Sah\Sdk\Zyins\Exception\IsaAuthException;
use Sah\Sdk\Zyins\Exception\IsaException;
use Sah\Sdk\Zyins\Exception\IsaIdempotencyConflictException;
use Sah\Sdk\Zyins\Exception\IsaLicenseException;
use Sah\Sdk\Zyins\Exception\IsaRateLimitException;
use Sah\Sdk\Zyins\Exception\IsaValidationException;
use Sah\Sdk\Zyins\Logging\DebugLogger;

/**
 * Thin protocol layer over a PSR-18 client.
 *
 * Owns header assembly (Authorization, Idempotency-Key, Version,
 * Content-Type) and response funneling (status → typed exception, body
 * → associative array). The HTTP client itself is constructor-injected
 * so consumers swap Guzzle for Symfony HttpClient by passing a
 * different PSR-18 instance.
 *
 * The DebugLogger (set via `ISA_LOG=debug` or a PSR-3 logger on the
 * client) dumps every request/response pair to stderr with secrets
 * and PII redacted.
 */
final readonly class Transport
{
    public const DEFAULT_BASE_URL = 'https://zyins.isaapi.com';

    public function __construct(
        private ClientInterface $http,
        private Auth $auth,
        private IdempotencyKeySource $keys,
        private string $baseUrl,
        private string $apiVersion,
        private string $userAgent,
        private DebugLogger $logger = new DebugLogger(),
    ) {
    }

    /**
     * Perform a POST that mutates state. Auto-attaches an idempotency
     * key unless one was supplied via {@see RequestOptions::withIdempotencyKey()}.
     *
     * @param array<string,mixed> $body
     */
    public function post(string $path, array $body, ?RequestOptions $options = null): DecodedResponse
    {
        [$decoded] = $this->send('POST', $path, $body, $options ?? RequestOptions::default());
        return $decoded;
    }

    /**
     * Same as {@see post()} but returns the parsed body alongside a
     * {@see RawResponse} snapshot — used by `*WithRawResponse(...)`
     * service variants. Mirrors Stainless/OpenAI/Anthropic SDK shape.
     *
     * @param array<string,mixed> $body
     * @return array{0: DecodedResponse, 1: RawResponse}
     */
    public function postWithRaw(string $path, array $body, ?RequestOptions $options = null): array
    {
        return $this->send('POST', $path, $body, $options ?? RequestOptions::default());
    }

    /**
     * Perform a GET. Idempotency-Key is not attached — GETs are
     * naturally idempotent.
     */
    public function get(string $path, ?RequestOptions $options = null): DecodedResponse
    {
        [$decoded] = $this->send('GET', $path, null, $options ?? RequestOptions::default());
        return $decoded;
    }

    /**
     * @return array{0: DecodedResponse, 1: RawResponse}
     */
    public function getWithRaw(string $path, ?RequestOptions $options = null): array
    {
        return $this->send('GET', $path, null, $options ?? RequestOptions::default());
    }

    /**
     * @param array<string,mixed>|null $body
     * @return array{0: DecodedResponse, 1: RawResponse}
     */
    private function send(string $method, string $path, ?array $body, RequestOptions $options): array
    {
        $headers = [
            'Authorization' => $this->auth->authorizationHeader(),
            'Accept' => 'application/json',
            'User-Agent' => $this->userAgent,
            'Version' => $options->version ?? $this->apiVersion,
        ];
        $rawBody = '';
        if ($body !== null) {
            $headers['Content-Type'] = 'application/json';
            try {
                $rawBody = json_encode($body, JSON_THROW_ON_ERROR);
            } catch (\JsonException $e) {
                throw new IsaException(
                    message: 'transport: failed to encode request body: ' . $e->getMessage(),
                    errorCode: 'invalid_request',
                    previous: $e,
                );
            }
        }
        $idempotencyKey = null;
        if ($method !== 'GET') {
            $idempotencyKey = $options->idempotencyKey ?? $this->keys->next();
            $headers['Idempotency-Key'] = $idempotencyKey;
        }

        $request = new Request($method, $this->baseUrl . $path, $headers, $rawBody);
        $this->logger->logRequest($request);
        try {
            $response = $this->http->sendRequest($request);
        } catch (ClientExceptionInterface $e) {
            throw new IsaException(
                message: 'transport: HTTP client error: ' . $e->getMessage(),
                errorCode: 'transport_error',
                previous: $e,
            );
        }
        $this->logger->logResponse($response, $request);

        $statusCode = $response->getStatusCode();
        $raw = new RawResponse(
            status: $statusCode,
            headers: $response->getHeaders(),
            url: (string) $request->getUri(),
            body: (string) $response->getBody(),
        );
        if ($statusCode >= 200 && $statusCode < 300) {
            $decoded = self::decodeBody($response, $idempotencyKey);
            return [$decoded, $raw];
        }
        throw self::buildException($response, $idempotencyKey);
    }

    private static function decodeBody(ResponseInterface $response, ?string $sentIdempotencyKey): DecodedResponse
    {
        $raw = (string) $response->getBody();
        if ($raw === '') {
            return new DecodedResponse([], null, $sentIdempotencyKey ?? '', 0);
        }
        try {
            $decoded = json_decode($raw, associative: true, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            // Wrap so consumers only have to catch IsaException — the
            // JsonException is preserved as $previous for diagnostics.
            throw new IsaException(
                message: 'transport: response body is not valid JSON: ' . $e->getMessage(),
                errorCode: 'invalid_response',
                previous: $e,
            );
        }
        if (! is_array($decoded)) {
            throw new IsaException(
                message: 'transport: response body is not a JSON object',
                errorCode: 'invalid_response',
            );
        }
        // read the inner shape only. Envelope metadata travels on the
        // DecodedResponse value object — never injected into the payload,
        // because list-shaped payloads (e.g. /v1/datasets) would expose
        // a magic key during iteration.
        $requestId = isset($decoded['request_id']) && is_string($decoded['request_id'])
            ? $decoded['request_id']
            : null;
        $envelopeKey = isset($decoded['idempotency_key']) && is_string($decoded['idempotency_key'])
            ? $decoded['idempotency_key']
            : null;
        $retryAttempts = isset($decoded['retry_attempts']) && is_int($decoded['retry_attempts'])
            ? $decoded['retry_attempts']
            : 0;
        $idempotencyKey = $envelopeKey ?? $sentIdempotencyKey ?? '';

        if (array_key_exists('data', $decoded) && is_array($decoded['data'])) {
            return new DecodedResponse($decoded['data'], $requestId, $idempotencyKey, $retryAttempts);
        }
        return new DecodedResponse($decoded, $requestId, $idempotencyKey, $retryAttempts);
    }

    private static function buildException(ResponseInterface $response, ?string $sentIdempotencyKey): IsaException
    {
        $status = $response->getStatusCode();
        $raw = (string) $response->getBody();
        $decoded = self::tryDecode($raw);

        $code = self::str($decoded, 'code') ?? 'unknown';
        $message = self::str($decoded, 'detail') ?? self::str($decoded, 'message') ?? $raw;
        if ($message === '') {
            $message = 'HTTP ' . $status;
        }
        $requestId = self::str($decoded, 'request_id');
        $param = self::str($decoded, 'param');
        $docUrl = self::str($decoded, 'doc_url');
        $adviceCode = self::str($decoded, 'advice_code');

        if ($status === 409 && ($code === IsaIdempotencyConflictException::CODE || self::str($decoded, 'key') !== null)) {
            $key = self::str($decoded, 'key') ?? $sentIdempotencyKey ?? '';
            $firstSeen = self::parseTimestamp(self::str($decoded, 'first_seen_at'));
            return new IsaIdempotencyConflictException(
                message: $message,
                key: $key,
                firstSeenAt: $firstSeen,
                requestId: $requestId,
                docUrl: $docUrl,
                adviceCode: $adviceCode,
            );
        }
        if ($status === 429) {
            $retryAfter = $response->getHeaderLine('Retry-After');
            return new IsaRateLimitException(
                message: $message,
                httpStatus: $status,
                requestId: $requestId,
                retryAfterSeconds: ctype_digit($retryAfter) ? (int) $retryAfter : null,
            );
        }
        if ($status === 401 || $status === 403) {
            return new IsaAuthException(
                message: $message,
                errorCode: $code === 'unknown' ? ($status === 401 ? 'unauthorized' : 'forbidden') : $code,
                httpStatus: $status,
                requestId: $requestId,
                docUrl: $docUrl,
                adviceCode: $adviceCode,
            );
        }
        if ($status === 400 || $code === 'validation_error') {
            $details = self::stringMap($decoded, 'details');
            return new IsaValidationException(
                message: $message,
                httpStatus: $status,
                requestId: $requestId,
                param: $param,
                details: $details,
            );
        }
        if (str_starts_with($code, 'license_') || $code === 'inactive' || $code === 'locked' || $code === 'max_activations' || $code === 'active_elsewhere' || $code === 'invalid_credentials' || $code === 'no_email') {
            return new IsaLicenseException(
                message: $message,
                errorCode: $code,
                httpStatus: $status,
                requestId: $requestId,
                docUrl: $docUrl,
                adviceCode: $adviceCode,
            );
        }
        return new IsaException(
            message: $message,
            errorCode: $code,
            httpStatus: $status,
            requestId: $requestId,
            docUrl: $docUrl,
            adviceCode: $adviceCode,
            param: $param,
        );
    }

    private static function parseTimestamp(?string $value): ?DateTimeImmutable
    {
        if ($value === null || $value === '') {
            return null;
        }
        try {
            return new DateTimeImmutable($value);
        } catch (\Exception) {
            return null;
        }
    }

    /**
     * @return array<string,mixed>|null
     */
    private static function tryDecode(string $body): ?array
    {
        if ($body === '' || ! str_starts_with(ltrim($body), '{')) {
            return null;
        }
        try {
            $decoded = json_decode($body, associative: true, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return null;
        }
        return is_array($decoded) ? $decoded : null;
    }

    /**
     * @param array<string,mixed>|null $decoded
     */
    private static function str(?array $decoded, string $key): ?string
    {
        if ($decoded === null) {
            return null;
        }
        $value = $decoded[$key] ?? null;
        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * @param array<string,mixed>|null $decoded
     * @return array<string,string>
     */
    private static function stringMap(?array $decoded, string $key): array
    {
        if ($decoded === null) {
            return [];
        }
        $value = $decoded[$key] ?? null;
        if (! is_array($value)) {
            return [];
        }
        $out = [];
        foreach ($value as $k => $v) {
            if (is_string($k) && is_string($v)) {
                $out[$k] = $v;
            }
        }
        return $out;
    }
}
