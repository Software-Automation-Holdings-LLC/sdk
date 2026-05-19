<?php

declare(strict_types=1);

namespace Sah\Sdk\Core;

use InvalidArgumentException;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use RuntimeException;

/**
 * Retries 429 + 5xx responses with exponential backoff and Retry-After
 * awareness (RFC 9110 §10.2.3). Honors both delta-seconds and HTTP-date
 * forms; falls back to exponential when the header is absent or
 * malformed.
 *
 * The clock and sleeper are injectable so tests assert the schedule
 * without burning wall-clock time.
 */
final readonly class RetryClient implements ClientInterface
{
    public const DEFAULT_MAX_ATTEMPTS = 5;
    public const DEFAULT_BASE_DELAY_MS = 250;
    public const DEFAULT_MAX_DELAY_MS = 8_000;
    private const MILLIS_PER_SECOND = 1_000;
    private const EXPONENTIAL_DOUBLING = 2;

    private int $maxAttempts;
    private int $baseDelayMs;
    private int $maxDelayMs;

    public function __construct(
        private ClientInterface $inner,
        private Clock $clock,
        private Sleeper $sleeper,
        ?int $maxAttempts = null,
        ?int $baseDelayMs = null,
        ?int $maxDelayMs = null,
    ) {
        $this->maxAttempts = $maxAttempts ?? self::DEFAULT_MAX_ATTEMPTS;
        $this->baseDelayMs = $baseDelayMs ?? self::DEFAULT_BASE_DELAY_MS;
        $this->maxDelayMs = $maxDelayMs ?? self::DEFAULT_MAX_DELAY_MS;
        if ($this->maxAttempts <= 0 || $this->baseDelayMs <= 0 || $this->maxDelayMs <= 0) {
            throw new InvalidArgumentException('Sah\\Sdk\\Core\\RetryClient requires positive maxAttempts, baseDelayMs, and maxDelayMs');
        }
    }

    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        $lastResponse = null;
        $lastException = null;
        for ($attempt = 1; $attempt <= $this->maxAttempts; $attempt++) {
            if ($attempt > 1) {
                $this->sleeper->sleep($this->computeDelayMs($lastResponse, $attempt - 1));
                $request = self::rewindBody($request);
            }
            try {
                $response = $this->inner->sendRequest($request);
                $lastException = null;
                if (! self::shouldRetry($response->getStatusCode())) {
                    return $response;
                }
                $lastResponse = $response;
            } catch (\Throwable $e) {
                $lastException = $e;
                $lastResponse = null;
            }
        }
        if ($lastException !== null) {
            throw $lastException;
        }
        // All attempts produced a retriable status; surface the last so
        // the caller logs request_id and decides downstream behavior.
        // Control flow guarantees a response was captured: the loop body
        // either returns a non-retriable response, stores $lastResponse,
        // or sets $lastException — and we just confirmed $lastException
        // is null. The runtime check satisfies PHPStan's null-narrowing.
        if ($lastResponse === null) {
            throw new \LogicException('Sah\\Sdk\\Core\\RetryClient: retry loop exited without capturing a response or exception');
        }
        return $lastResponse;
    }

    private function computeDelayMs(?ResponseInterface $prev, int $retryCount): int
    {
        if ($prev !== null) {
            $hint = self::parseRetryAfter($prev->getHeaderLine('Retry-After'), $this->clock->nowMilliseconds());
            if ($hint !== null) {
                return min($hint, $this->maxDelayMs);
            }
        }
        $delay = $this->baseDelayMs;
        for ($i = 1; $i < $retryCount; $i++) {
            $delay *= self::EXPONENTIAL_DOUBLING;
            if ($delay >= $this->maxDelayMs) {
                return $this->maxDelayMs;
            }
        }
        return $delay;
    }

    private static function shouldRetry(int $status): bool
    {
        return $status === 429 || ($status >= 500 && $status < 600);
    }

    /**
     * Parses RFC 9110 Retry-After. Returns ms, or null on parse failure
     * so the caller falls back to exponential backoff.
     */
    public static function parseRetryAfter(string $raw, int $nowMs): ?int
    {
        $trimmed = trim($raw);
        if ($trimmed === '') {
            return null;
        }
        if (preg_match('/^[0-9]+$/', $trimmed)) {
            return (int) $trimmed * self::MILLIS_PER_SECOND;
        }
        if (preg_match('/^[+\-][0-9]/', $trimmed)) {
            return null;
        }
        $parsed = strtotime($trimmed);
        if ($parsed === false) {
            return null;
        }
        $deltaMs = ($parsed * self::MILLIS_PER_SECOND) - $nowMs;
        return $deltaMs > 0 ? (int) $deltaMs : null;
    }

    /**
     * PSR-7 streams are read-once. Before each retry, rewind the body
     * stream so the inner client sees identical bytes on every attempt.
     */
    private static function rewindBody(RequestInterface $request): RequestInterface
    {
        $body = $request->getBody();
        if (! $body->isSeekable()) {
            throw new RuntimeException(
                'Sah\\Sdk\\Core\\Transport\\RetryClient cannot retry this request: the body stream is not rewindable'
            );
        }
        $body->rewind();

        return $request;
    }
}
