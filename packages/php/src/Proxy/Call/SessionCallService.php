<?php

declare(strict_types=1);

namespace Sah\Sdk\Proxy\Call;

use DateTimeImmutable;
use DateTimeZone;
use GuzzleHttp\Psr7\Request;
use Psr\Http\Client\ClientExceptionInterface;
use Psr\Http\Client\ClientInterface;
use Sah\Sdk\Proxy\Clock;
use Sah\Sdk\Proxy\Exception\ProxyAuthException;
use Sah\Sdk\Proxy\Exception\ProxyException;
use Sah\Sdk\Proxy\Exception\ProxyValidationException;
use Sah\Sdk\Proxy\IdempotencyKeySource;
use Sah\Sdk\Zyins\Auth as IdentityAuth;
use Sah\Sdk\Zyins\Exception\IsaConfigException;
use Sah\Sdk\Zyins\Exception\IsaIdempotencyConflictException;
use Sah\Sdk\Zyins\SignRequest;

/**
 * `proxy.call()` — structured invocation against `/v1/call`, signed with
 * canonical session-credential HMAC.
 *
 * Envelope shape (opaque pass-through; do NOT flatten):
 *
 *   { integration_id | integration_uuid, method, params }
 *
 * The SDK↔proxy hop is signed via {@see SignRequest::sign()}; the
 * proxy↔downstream hop remains Algosure HMAC and is handled server-side
 * (ADR-035, amended in PR #<this>).
 */
final class SessionCallService
{
    public const PATH = '/v1/call';

    public function __construct(
        private readonly ClientInterface $http,
        private readonly string $baseUrl,
        private readonly ?IdentityAuth $identityAuth,
        private readonly IdempotencyKeySource $idempotency,
        private readonly Clock $clock,
    ) {
    }

    /**
     * Invoke a registered integration through the platform proxy.
     *
     * @param array<string, mixed>|null $params Opaque JSON-serializable payload.
     *
     * @throws IsaConfigException when the parent Isa was constructed with a
     *   non-session credential (bearer / license).
     * @throws ProxyValidationException when neither/both of
     *   integrationUuid / integrationId are supplied, or on a 400 response.
     * @throws ProxyAuthException on a 401 response.
     * @throws IsaIdempotencyConflictException on a 409 idempotency_conflict.
     * @throws ProxyException on any other non-2xx response.
     *
     * @return array<string, mixed>|null parsed JSON response body.
     */
    public function call(
        ?string $integrationUuid = null,
        ?int $integrationId = null,
        ?array $params = null,
        string $method = 'POST',
        ?string $idempotencyKey = null,
    ): ?array {
        $this->assertSessionIdentity();
        $this->validateIdentifier($integrationUuid, $integrationId);
        $body = $this->buildEnvelopeBody($integrationUuid, $integrationId, $method, $params);
        $headers = $this->buildSignedHeaders($body, $idempotencyKey);
        $request = new Request('POST', $this->baseUrl . self::PATH, $headers, $body);
        try {
            $response = $this->http->sendRequest($request);
        } catch (ClientExceptionInterface $e) {
            throw new ProxyException(
                message: 'proxy.call: HTTP client error: ' . $e->getMessage(),
                errorCode: 'transport_error',
                previous: $e,
            );
        }
        $status = $response->getStatusCode();
        $raw = (string) $response->getBody();
        if ($status >= 200 && $status < 300) {
            return $this->decodeBody($raw);
        }
        throw $this->mapError($status, $raw);
    }

    private function assertSessionIdentity(): void
    {
        if ($this->identityAuth === null || ! $this->identityAuth->isSession()) {
            throw new IsaConfigException(
                'proxy.call requires a Session identity; exchange your bearer/license credentials via account.sessions.create first'
            );
        }
        if ($this->identityAuth->sessionSecret === null) {
            throw new IsaConfigException(
                'proxy.call requires a Session identity with a session secret; reconstruct via Isa::withSession()'
            );
        }
    }

    private function validateIdentifier(?string $uuid, ?int $id): void
    {
        $hasUuid = is_string($uuid) && $uuid !== '';
        $hasId = $id !== null && $id > 0;
        if ($id !== null && ! $hasId) {
            throw new ProxyValidationException(
                message: 'proxy.call: integrationId must be a positive integer',
                httpStatus: 400,
                param: 'integration_id',
                errorCode: 'validation_error',
            );
        }
        if ($hasUuid && $hasId) {
            throw new ProxyValidationException(
                message: 'proxy.call: supply exactly one of integrationUuid or integrationId',
                httpStatus: 400,
                param: 'integration_uuid',
                errorCode: 'validation_error',
            );
        }
        if (! $hasUuid && ! $hasId) {
            throw new ProxyValidationException(
                message: 'proxy.call: supply exactly one of integrationUuid or integrationId',
                httpStatus: 400,
                param: 'integration_uuid',
                errorCode: 'validation_error',
            );
        }
    }

    /**
     * @param array<string, mixed>|null $params
     */
    private function buildEnvelopeBody(
        ?string $integrationUuid,
        ?int $integrationId,
        string $method,
        ?array $params,
    ): string {
        $envelope = [];
        if ($integrationUuid !== null && $integrationUuid !== '') {
            $envelope['integration_uuid'] = $integrationUuid;
        } else {
            $envelope['integration_id'] = $integrationId;
        }
        $envelope['method'] = $method;
        $envelope['params'] = $params;
        return json_encode(
            $envelope,
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
        );
    }

    /**
     * @return array<string, string>
     */
    private function buildSignedHeaders(string $body, ?string $idempotencyKey): array
    {
        $auth = $this->identityAuth;
        if ($auth === null) {
            throw new IsaConfigException(
                'proxy.call requires a Session identity; exchange your bearer/license credentials via account.sessions.create first'
            );
        }
        // assertSessionIdentity guarantees both are non-null here.
        $now = (new DateTimeImmutable('@' . intdiv($this->clock->nowMillis(), 1000)))
            ->setTimezone(new DateTimeZone('UTC'));
        $signed = SignRequest::sign(
            method: 'POST',
            path: self::PATH,
            body: $body,
            sessionId: $auth->token,
            sessionSecret: $auth->sessionSecret ?? '',
            now: $now,
        );
        $signed['Content-Type'] = 'application/json';
        $signed['Idempotency-Key'] = $idempotencyKey ?? $this->idempotency->next();
        return $signed;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function decodeBody(string $raw): ?array
    {
        if ($raw === '') {
            return null;
        }
        try {
            $decoded = json_decode($raw, associative: true, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new ProxyException(
                message: 'proxy.call: response body is not valid JSON',
                errorCode: 'invalid_response',
            );
        }
        return is_array($decoded) ? $decoded : null;
    }

    private function mapError(int $status, string $raw): \Throwable
    {
        $decoded = $this->tryDecode($raw);
        $code = self::stringField($decoded, 'code') ?? 'unknown';
        $message = self::stringField($decoded, 'detail')
            ?? self::stringField($decoded, 'message')
            ?? ('HTTP ' . $status);
        $requestId = self::stringField($decoded, 'request_id');
        if ($status === 401) {
            return new ProxyAuthException(
                message: $message,
                errorCode: $code === 'unknown' ? 'unauthorized' : $code,
                httpStatus: $status,
                requestId: $requestId,
            );
        }
        if ($status === 400) {
            return new ProxyValidationException(
                message: $message,
                httpStatus: $status,
                requestId: $requestId,
                param: self::stringField($decoded, 'param'),
                errorCode: $code === 'unknown' ? 'validation_error' : $code,
            );
        }
        if ($status === 409 && $code === 'idempotency_conflict') {
            return new IsaIdempotencyConflictException(
                message: $message,
                key: self::stringField($decoded, 'key') ?? '',
                firstSeenAt: self::dateTimeField($decoded, 'first_seen_at'),
                requestId: $requestId,
            );
        }
        return new ProxyException(
            message: $message,
            errorCode: $code,
            httpStatus: $status,
            requestId: $requestId,
        );
    }

    /**
     * @return array<string, mixed>|null
     */
    private function tryDecode(string $body): ?array
    {
        if ($body === '' || ! str_starts_with(ltrim($body), '{')) {
            return null;
        }
        try {
            $d = json_decode($body, associative: true, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return null;
        }
        return is_array($d) ? $d : null;
    }

    /**
     * @param array<string, mixed>|null $decoded
     */
    private static function stringField(?array $decoded, string $key): ?string
    {
        if ($decoded === null) {
            return null;
        }
        $v = $decoded[$key] ?? null;
        return is_string($v) && $v !== '' ? $v : null;
    }

    /**
     * @param array<string, mixed>|null $decoded
     */
    private static function dateTimeField(?array $decoded, string $key): ?DateTimeImmutable
    {
        $value = self::stringField($decoded, $key);
        if ($value === null) {
            return null;
        }
        try {
            return new DateTimeImmutable($value);
        } catch (\Exception) {
            return null;
        }
    }
}
