<?php

declare(strict_types=1);

namespace Isa\Sdk\Core;

use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestFactoryInterface;
use Psr\Http\Message\StreamFactoryInterface;
use RuntimeException;

/**
 * Atomic session cache + single-flight bootstrap driver.
 *
 * PHP runs one request per worker process (no shared in-process
 * concurrency), so "single-flight" here means: a single Store
 * instance — held for one HTTP request lifecycle — performs at most
 * one POST /v1/sessions per call to {@see SessionStore::currentSecret()}
 * when the cache is cold.
 *
 * Consumers running a long-lived process (e.g. a worker) should hold
 * one Store across requests so the cached session survives — the
 * 24-hour expiry covers most workloads without re-bootstrap.
 *
 * The 30-second grace overlap lives server-side (see
 * services/account/internal/handler/sessions_bootstrap.go); the
 * client just retries on 401 and never tracks the previous secret.
 */
final class SessionStore
{
    /** How close to expiry {@see onActivity} proactively re-mints. */
    private const PROACTIVE_WINDOW_SECONDS = 300;

    private ?Session $current = null;

    /**
     * Counts network bootstraps performed by this store. Exposed so
     * tests can assert exactly 1 after sequential calls during a
     * cold-start window.
     */
    private int $bootstrapCount = 0;

    public function __construct(
        private readonly ClientInterface $client,
        private readonly RequestFactoryInterface $requestFactory,
        private readonly StreamFactoryInterface $streamFactory,
        private readonly Clock $clock,
        private readonly string $baseUrl,
        private readonly string $keycode,
        private readonly string $email,
        private readonly string $licenseKey,
        private readonly string $deviceId,
    ) {
        if (strlen($baseUrl) === 0) {
            throw new \InvalidArgumentException('SessionStore: baseUrl must be non-empty');
        }
        if (strlen($keycode) === 0 || strlen($email) === 0 || strlen($licenseKey) === 0 || strlen($deviceId) === 0) {
            throw new \InvalidArgumentException(
                'SessionStore: keycode, email, licenseKey, deviceId all required'
            );
        }
    }

    public function bootstrapCount(): int
    {
        return $this->bootstrapCount;
    }

    /**
     * Return the cached session if present and not past expiry.
     * Returns null when the caller must {@see bootstrap}.
     */
    public function currentSecret(): ?Session
    {
        if ($this->current === null) {
            return null;
        }
        if ($this->nowDateTime() >= $this->current->expiresAt) {
            return null;
        }
        return $this->current;
    }

    /**
     * Perform POST /v1/sessions with the embedded HMAC signature.
     * Returns the cached session if a concurrent caller already
     * bootstrapped (double-checked under the call sequence).
     */
    public function bootstrap(): Session
    {
        if ($this->current !== null && $this->nowDateTime() < $this->current->expiresAt) {
            return $this->current;
        }
        $this->current = $this->doExchange();
        ++$this->bootstrapCount;
        return $this->current;
    }

    /** Convert the millisecond clock to a UTC DateTimeImmutable. */
    private function nowDateTime(): DateTimeImmutable
    {
        $ms = $this->clock->nowMilliseconds();
        $seconds = intdiv($ms, 1000);
        return (new DateTimeImmutable('@' . $seconds))->setTimezone(new DateTimeZone('UTC'));
    }

    /** Clear the cached session. Called by the interceptor on 401. */
    public function invalidate(): void
    {
        $this->current = null;
    }

    /**
     * Consumer-facing proactive-refresh hook. If the cached session
     * is within {@see PROACTIVE_WINDOW_SECONDS} of expiry, re-mint now.
     */
    public function onActivity(): void
    {
        $now = $this->nowDateTime();
        $cur = $this->current;
        if ($cur === null) {
            $this->bootstrap();
            return;
        }
        $proactiveDeadline = $cur->expiresAt->sub(new DateInterval('PT' . self::PROACTIVE_WINDOW_SECONDS . 'S'));
        if ($now >= $proactiveDeadline) {
            $this->current = null;
            $this->bootstrap();
        }
    }

    private function doExchange(): Session
    {
        $ts = intdiv($this->clock->nowMilliseconds(), 1000);
        $sig = Bootstrap::build(
            $this->keycode,
            $this->email,
            $this->licenseKey,
            $this->deviceId,
            'POST',
            '/v1/sessions',
            $ts,
        );
        $request = $this->requestFactory
            ->createRequest('POST', rtrim($this->baseUrl, '/') . '/v1/sessions')
            ->withHeader('Content-Type', 'application/json')
            ->withHeader('X-Device-ID', $this->deviceId)
            ->withHeader('ISA-Signature', sprintf('t=%d,v1=%s', $ts, $sig->hex))
            ->withBody($this->streamFactory->createStream($sig->serializedBody));
        $response = $this->client->sendRequest($request);
        $status = $response->getStatusCode();
        if ($status < 200 || $status >= 300) {
            $body = (string) $response->getBody();
            throw new RuntimeException(sprintf(
                'SessionStore: POST /v1/sessions returned %d: %s',
                $status,
                substr($body, 0, 200),
            ));
        }
        /** @var array<string, mixed> $payload */
        $payload = json_decode((string) $response->getBody(), true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($payload)) {
            throw new RuntimeException('SessionStore: response body was not a JSON object');
        }
        $sessionPayload = $payload['data'] ?? $payload;
        if (!is_array($sessionPayload)) {
            throw new RuntimeException('SessionStore: response data was not a JSON object');
        }
        $sessionId = $sessionPayload['sessionId'] ?? null;
        $sessionSecret = $sessionPayload['sessionSecret'] ?? null;
        $expiresAtRaw = $sessionPayload['expiresAt'] ?? null;
        if (
            !is_string($sessionId) || $sessionId === ''
            || !is_string($sessionSecret) || $sessionSecret === ''
            || !is_string($expiresAtRaw) || $expiresAtRaw === ''
        ) {
            throw new RuntimeException('SessionStore: response missing sessionId/sessionSecret/expiresAt');
        }
        $expiresAt = new DateTimeImmutable($expiresAtRaw, new DateTimeZone('UTC'));
        return new Session($sessionId, $sessionSecret, $expiresAt);
    }
}
