<?php

declare(strict_types=1);

namespace Isa\Sdk\Proxy;

use GuzzleHttp\Psr7\Request;
use Psr\Http\Client\ClientExceptionInterface;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\ResponseInterface;
use Isa\Sdk\Proxy\Exception\IntegrationNotFoundException;
use Isa\Sdk\Proxy\Exception\IsaException;
use Isa\Sdk\Proxy\Exception\ProxyAuthException;
use Isa\Sdk\Proxy\Exception\ProxyException;
use Isa\Sdk\Proxy\Exception\ProxyRateLimitException;
use Isa\Sdk\Proxy\Exception\ProxyValidationException;

/**
 * Thin protocol layer over a PSR-18 client for the proxy API.
 *
 * Owns header assembly (Authorization, Idempotency-Key, Version,
 * Content-Type) and response funneling (status → typed exception, body
 * → associative array). Algosure HMAC signing lives in
 * {@see Algosure\AlgosureSigner} — the SDK↔proxy hop uses plain bearer
 * auth; Algosure is for the proxy↔downstream hop.
 */
final readonly class Transport
{
    private const JSON_ENCODE_FLAGS = JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

    public const DEFAULT_BASE_URL = 'https://proxy.isaapi.com';
    public const DEFAULT_API_VERSION = '2026-05-18';
    public const USER_AGENT_VERSION = '1.0.0';

    public function __construct(
        private ClientInterface $http,
        private Auth $auth,
        private IdempotencyKeySource $keys,
        private string $baseUrl,
        private string $apiVersion,
        private string $userAgent,
    ) {
    }

    /**
     * @param array<string,mixed> $body
     */
    public function post(string $path, array $body, ?RequestOptions $options = null): DecodedResponse
    {
        return $this->send('POST', $path, $body, $options ?? RequestOptions::default());
    }

    public function get(string $path, ?RequestOptions $options = null): DecodedResponse
    {
        return $this->send('GET', $path, null, $options ?? RequestOptions::default());
    }

    /**
     * @param array<string,mixed>|null $body
     */
    private function send(string $method, string $path, ?array $body, RequestOptions $options): DecodedResponse
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
                $rawBody = json_encode($body, self::JSON_ENCODE_FLAGS);
            } catch (\JsonException $e) {
                throw new ProxyException(
                    message: 'proxy: failed to encode request body: ' . $e->getMessage(),
                    errorCode: 'invalid_request',
                    previous: $e,
                );
            }
        }
        if ($method !== 'GET') {
            $headers['Idempotency-Key'] = $options->idempotencyKey ?? $this->keys->next();
        }

        $request = new Request($method, $this->baseUrl . $path, $headers, $rawBody);
        try {
            $response = $this->http->sendRequest($request);
        } catch (ClientExceptionInterface $e) {
            throw new ProxyException(
                message: 'proxy: HTTP client error: ' . $e->getMessage(),
                errorCode: 'transport_error',
                previous: $e,
            );
        }

        $status = $response->getStatusCode();
        if ($status >= 200 && $status < 300) {
            return self::decodeBody($response);
        }
        throw self::buildException($response);
    }

    private static function decodeBody(ResponseInterface $response): DecodedResponse
    {
        $raw = (string) $response->getBody();
        if ($raw === '') {
            return new DecodedResponse([], null);
        }
        try {
            $decoded = json_decode($raw, associative: true, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            throw new ProxyException(
                message: 'proxy: response body is not valid JSON: ' . $e->getMessage(),
                errorCode: 'invalid_response',
                previous: $e,
            );
        }
        $trimmed = trim($raw);
        if (
            ! is_array($decoded)
            || $trimmed === '[]'
            || ($decoded !== [] && array_is_list($decoded))
        ) {
            throw new ProxyException(
                message: 'proxy: response body is not a JSON object',
                errorCode: 'invalid_response',
            );
        }
        $requestId = isset($decoded['request_id']) && is_string($decoded['request_id'])
            ? $decoded['request_id']
            : null;
        if (array_key_exists('data', $decoded) && is_array($decoded['data'])) {
            return new DecodedResponse($decoded['data'], $requestId);
        }
        return new DecodedResponse($decoded, $requestId);
    }

    private static function buildException(ResponseInterface $response): IsaException
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

        if ($status === 429) {
            $retryAfter = $response->getHeaderLine('Retry-After');
            return new ProxyRateLimitException(
                message: $message,
                httpStatus: $status,
                requestId: $requestId,
                retryAfterSeconds: ctype_digit($retryAfter) ? (int) $retryAfter : null,
                docUrl: $docUrl,
                adviceCode: $adviceCode,
            );
        }
        if ($status === 401 || $status === 403) {
            return new ProxyAuthException(
                message: $message,
                errorCode: $code === 'unknown' ? ($status === 401 ? 'unauthorized' : 'forbidden') : $code,
                httpStatus: $status,
                requestId: $requestId,
                docUrl: $docUrl,
                adviceCode: $adviceCode,
            );
        }
        if ($status === 404 && ($code === 'integration_not_found' || $code === 'not_found')) {
            return new IntegrationNotFoundException(
                message: $message,
                errorCode: $code,
                httpStatus: $status,
                requestId: $requestId,
                docUrl: $docUrl,
                adviceCode: $adviceCode,
            );
        }
        if ($status === 400 || $status === 422) {
            $details = self::stringMap($decoded, 'details');
            return new ProxyValidationException(
                message: $message,
                httpStatus: $status,
                requestId: $requestId,
                param: $param,
                details: $details,
                errorCode: $code === 'unknown' ? 'validation_error' : $code,
                docUrl: $docUrl,
                adviceCode: $adviceCode,
            );
        }
        return new ProxyException(
            message: $message,
            errorCode: $code,
            httpStatus: $status,
            requestId: $requestId,
            docUrl: $docUrl,
            adviceCode: $adviceCode,
            param: $param,
        );
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
