<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

use GuzzleHttp\Psr7\Request;
use JsonException;
use Psr\Http\Client\ClientExceptionInterface;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\ResponseInterface;
use Isa\Sdk\Core\TokenSource;
use Isa\Sdk\Zyins\Auth;
use Isa\Sdk\Zyins\Exception\IsaAuthException;
use Isa\Sdk\Zyins\Exception\IsaException;
use Isa\Sdk\Zyins\Exception\IsaIdempotencyConflictException;
use Isa\Sdk\Zyins\Exception\IsaRateLimitException;
use Isa\Sdk\Zyins\Exception\IsaValidationException;

/**
 * Shared HTTP plumbing for `isa.account.*` sub-clients.
 *
 * Every endpoint under `account.isaapi.com` shares the same wire shape:
 *  - POST with `Content-Type: application/json`
 *  - Optional `Authorization: <scheme> <token>` from a {@see TokenSource}
 *  - BaseResponse envelope on success (CONTRACT C13)
 *  - RFC 7807 ProblemDetails on 4xx / 5xx funneling into `IsaException`
 *
 * Centralizing here keeps the per-resource clients well under the
 * 250-line ceiling and ensures every endpoint speaks the envelope
 * identically.
 */
final readonly class Http
{
    public const DEFAULT_BASE_URL = 'https://account.isaapi.com';

    public function __construct(
        private ClientInterface $http,
        private string $baseUrl,
        private ?TokenSource $tokenSource = null,
        private string $authorizationScheme = Auth::SCHEME_BEARER,
    ) {
    }

    /**
     * POST a JSON body and return the decoded BaseResponse envelope.
     *
     * Returns a {@see BaseResponse} whose `data` field is `mixed` — the
     * per-resource client narrows it to its typed payload via a
     * dedicated `fromWire()` factory.
     *
     * @param array<string,mixed> $payload
     * @throws IsaException
     */
    public function postEnvelope(string $path, array $payload, bool $allowMissingData = false): BaseResponse
    {
        $raw = $this->postRaw($path, $payload);
        return $this->parseEnvelope($raw, $allowMissingData);
    }

    /**
     * POST a JSON body and return the top-level JSON object verbatim.
     * Used by endpoints whose envelope carries extra sibling fields
     * (e.g. `has_more` on list responses).
     *
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     * @throws IsaException
     */
    public function postRawEnvelope(string $path, array $payload): array
    {
        $raw = $this->postRaw($path, $payload);
        if ($raw === '') {
            throw new IsaException('account: response body was empty', 'unknown');
        }
        try {
            /** @var mixed $parsed */
            $parsed = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new IsaException('account: response body was not JSON', 'unknown', previous: $e);
        }
        if (! is_array($parsed)) {
            throw new IsaException('account: response body was not a JSON object', 'unknown');
        }
        /** @var array<string,mixed> $parsed */
        return $parsed;
    }

    /**
     * @param array<string,mixed> $payload
     * @throws IsaException
     */
    private function postRaw(string $path, array $payload): string
    {
        try {
            $body = json_encode($payload, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new IsaException('account: failed to encode request body', 'unknown', previous: $e);
        }
        $headers = [
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];
        if ($this->tokenSource !== null) {
            $headers['Authorization'] = $this->authorizationScheme . ' ' . $this->tokenSource->token();
        }
        $request = new Request('POST', $this->baseUrl . $path, $headers, $body);

        try {
            $response = $this->http->sendRequest($request);
        } catch (ClientExceptionInterface $e) {
            throw new IsaException('account: transport failure: ' . $e->getMessage(), 'transport_error', previous: $e);
        }

        $status = $response->getStatusCode();
        $bodyStr = (string) $response->getBody();
        if ($status < 200 || $status >= 300) {
            throw $this->errorFromResponse($response, $bodyStr);
        }
        return $bodyStr;
    }

    private function parseEnvelope(string $body, bool $allowMissingData = false): BaseResponse
    {
        if ($body === '') {
            throw new IsaException('account: response body was empty', 'unknown');
        }
        try {
            /** @var mixed $parsed */
            $parsed = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new IsaException('account: failed to parse response body as JSON', 'unknown', previous: $e);
        }
        if (! is_array($parsed)) {
            throw new IsaException('account: response body was not a JSON object', 'unknown');
        }

        $object = is_string($parsed['object'] ?? null) ? (string) $parsed['object'] : '';
        if ($object === '') {
            throw new IsaException('account: response envelope missing `object` field', 'unknown');
        }
        if (! is_bool($parsed['livemode'] ?? null)) {
            throw new IsaException('account: response envelope missing or invalid `livemode` field', 'unknown');
        }
        $livemode = (bool) $parsed['livemode'];
        $requestId = is_string($parsed['request_id'] ?? null) ? (string) $parsed['request_id'] : '';
        $idemKey = is_string($parsed['idempotency_key'] ?? null) ? (string) $parsed['idempotency_key'] : '';
        if (! array_key_exists('data', $parsed) && ! $allowMissingData) {
            throw new IsaException('account: response envelope missing `data` field', 'unknown');
        }
        /** @var mixed $data */
        $data = array_key_exists('data', $parsed) ? $parsed['data'] : $parsed;

        return new BaseResponse(
            object: $object,
            livemode: $livemode,
            requestId: $requestId,
            idempotencyKey: $idemKey,
            data: $data,
        );
    }

    private function errorFromResponse(ResponseInterface $response, string $body): IsaException
    {
        $status = $response->getStatusCode();
        /** @var array<string,mixed>|null $problem */
        $problem = null;
        $trimmed = ltrim($body);
        if ($trimmed !== '' && $trimmed[0] === '{') {
            try {
                /** @var mixed $decoded */
                $decoded = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
                if (is_array($decoded)) {
                    /** @var array<string,mixed> $decoded */
                    $problem = $decoded;
                }
            } catch (JsonException) {
                $problem = null;
            }
        }
        if ($problem === null) {
            return new IsaException(
                message: $body === '' ? sprintf('HTTP %d', $status) : $body,
                errorCode: 'unknown',
                httpStatus: $status,
            );
        }
        $code = is_string($problem['code'] ?? null) ? (string) $problem['code'] : 'unknown';
        $message = is_string($problem['detail'] ?? null)
            ? (string) $problem['detail']
            : (is_string($problem['title'] ?? null) ? (string) $problem['title'] : sprintf('HTTP %d', $status));
        $requestId = is_string($problem['request_id'] ?? null) ? (string) $problem['request_id'] : null;
        $advice = is_string($problem['advice_code'] ?? null) ? (string) $problem['advice_code'] : null;
        $docUrl = is_string($problem['doc_url'] ?? null) ? (string) $problem['doc_url'] : null;
        $param = is_string($problem['param'] ?? null) ? (string) $problem['param'] : null;

        $key = is_string($problem['key'] ?? null) ? (string) $problem['key'] : '';
        return match ($code) {
            'idempotency_conflict' => new IsaIdempotencyConflictException(
                message: $message,
                key: $key,
                requestId: $requestId,
                docUrl: $docUrl,
                adviceCode: $advice,
            ),
            'unauthorized', 'invalid_token', 'token_expired' => new IsaAuthException(
                message: $message,
                errorCode: $code,
                httpStatus: $status,
                requestId: $requestId,
                adviceCode: $advice,
                docUrl: $docUrl,
            ),
            'rate_limit_exceeded' => new IsaRateLimitException(
                message: $message,
                httpStatus: $status,
                requestId: $requestId,
                retryAfterSeconds: $this->retryAfterSeconds($response),
            ),
            'validation_error' => new IsaValidationException(
                message: $message,
                httpStatus: $status,
                requestId: $requestId,
                param: $param,
            ),
            default => new IsaException(
                message: $message,
                errorCode: $code,
                httpStatus: $status,
                requestId: $requestId,
                adviceCode: $advice,
                docUrl: $docUrl,
                param: $param,
            ),
        };
    }

    private function retryAfterSeconds(ResponseInterface $response): ?int
    {
        $retryAfter = $response->getHeaderLine('Retry-After');
        return ctype_digit($retryAfter) ? (int) $retryAfter : null;
    }
}
