<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Core;

use Nyholm\Psr7\Factory\Psr17Factory;
use PHPUnit\Framework\TestCase;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\StreamInterface;
use RuntimeException;
use Isa\Sdk\Core\Clock;
use Isa\Sdk\Core\RetryClient;
use Isa\Sdk\Core\Sleeper;

final class RetryClientTest extends TestCase
{
    private const TEST_BASE_DELAY_MS = 10;
    private const TEST_MAX_DELAY_MS = 10_000;
    private const TEST_MAX_ATTEMPTS = 4;

    /**
     * @param list<array{status?: int, retryAfter?: string, exception?: \Throwable}> $steps
     */
    private function scriptedClient(array $steps, Psr17Factory $factory): ClientInterface
    {
        return new class ($steps, $factory) implements ClientInterface {
            private int $idx = 0;

            public function __construct(
                /** @var list<array{status?: int, retryAfter?: string, exception?: \Throwable}> */
                private array $steps,
                private Psr17Factory $factory,
            ) {
            }

            public function sendRequest(RequestInterface $request): ResponseInterface
            {
                if (! isset($this->steps[$this->idx])) {
                    throw new RuntimeException('scriptedClient: out of steps');
                }
                $step = $this->steps[$this->idx];
                $this->idx++;
                if (isset($step['exception'])) {
                    throw $step['exception'];
                }
                $resp = $this->factory->createResponse($step['status'] ?? 200);
                if (isset($step['retryAfter'])) {
                    $resp = $resp->withHeader('Retry-After', $step['retryAfter']);
                }
                return $resp;
            }
        };
    }

    private function recordingSleeper(): Sleeper
    {
        return new class () implements Sleeper {
            /** @var list<int> */
            public array $calls = [];

            public function sleep(int $milliseconds): void
            {
                $this->calls[] = $milliseconds;
            }
        };
    }

    private function fixedClock(int $nowMs): Clock
    {
        return new class ($nowMs) implements Clock {
            public function __construct(private int $nowMs)
            {
            }

            public function nowMilliseconds(): int
            {
                return $this->nowMs;
            }
        };
    }

    public function testHappyPathDoesNotSleep(): void
    {
        $factory = new Psr17Factory();
        $sleeper = $this->recordingSleeper();
        $client = new RetryClient(
            inner: $this->scriptedClient([['status' => 200]], $factory),
            clock: $this->fixedClock(0),
            sleeper: $sleeper,
            maxAttempts: self::TEST_MAX_ATTEMPTS,
            baseDelayMs: self::TEST_BASE_DELAY_MS,
            maxDelayMs: self::TEST_MAX_DELAY_MS,
        );
        $resp = $client->sendRequest($factory->createRequest('GET', 'http://example/v1/x'));
        self::assertSame(200, $resp->getStatusCode());
        self::assertSame([], $sleeper->calls);
    }

    public function testRetryAfterDeltaSecondsHonored(): void
    {
        $factory = new Psr17Factory();
        $sleeper = $this->recordingSleeper();
        $client = new RetryClient(
            inner: $this->scriptedClient([
                ['status' => 429, 'retryAfter' => '1'],
                ['status' => 429, 'retryAfter' => '2'],
                ['status' => 200],
            ], $factory),
            clock: $this->fixedClock(0),
            sleeper: $sleeper,
            maxAttempts: self::TEST_MAX_ATTEMPTS,
            baseDelayMs: self::TEST_BASE_DELAY_MS,
            maxDelayMs: self::TEST_MAX_DELAY_MS,
        );
        $resp = $client->sendRequest($factory->createRequest('GET', 'http://example/v1/x'));
        self::assertSame(200, $resp->getStatusCode());
        self::assertSame([1000, 2000], $sleeper->calls);
    }

    public function testClearsStaleExceptionAfterLaterSuccessfulAttempt(): void
    {
        $factory = new Psr17Factory();
        $sleeper = $this->recordingSleeper();
        $timeout = new RuntimeException('timeout');
        $client = new RetryClient(
            inner: $this->scriptedClient([
                ['exception' => $timeout],
                ['status' => 200],
            ], $factory),
            clock: $this->fixedClock(0),
            sleeper: $sleeper,
            maxAttempts: self::TEST_MAX_ATTEMPTS,
            baseDelayMs: self::TEST_BASE_DELAY_MS,
            maxDelayMs: self::TEST_MAX_DELAY_MS,
        );
        $resp = $client->sendRequest($factory->createRequest('GET', 'http://example/v1/x'));
        self::assertSame(200, $resp->getStatusCode());
    }

    public function testDoesNotReuseRetryAfterAfterTransportError(): void
    {
        $factory = new Psr17Factory();
        $sleeper = $this->recordingSleeper();
        $netErr = new RuntimeException('connection reset');
        $client = new RetryClient(
            inner: $this->scriptedClient([
                ['status' => 429, 'retryAfter' => '1'],
                ['exception' => $netErr],
                ['status' => 200],
            ], $factory),
            clock: $this->fixedClock(0),
            sleeper: $sleeper,
            maxAttempts: self::TEST_MAX_ATTEMPTS,
            baseDelayMs: self::TEST_BASE_DELAY_MS,
            maxDelayMs: self::TEST_MAX_DELAY_MS,
        );
        $resp = $client->sendRequest($factory->createRequest('GET', 'http://example/v1/x'));
        self::assertSame(200, $resp->getStatusCode());
        self::assertSame([1000, self::TEST_BASE_DELAY_MS * 2], $sleeper->calls);
    }

    public function testNonSeekableRequestBodyCannotRetry(): void
    {
        $factory = new Psr17Factory();
        $sleeper = $this->recordingSleeper();
        $stream = $this->createMock(StreamInterface::class);
        $stream->method('isSeekable')->willReturn(false);
        $request = $factory->createRequest('POST', 'http://example/upload')->withBody($stream);
        $client = new RetryClient(
            inner: $this->scriptedClient([
                ['status' => 429, 'retryAfter' => '1'],
                ['status' => 200],
            ], $factory),
            clock: $this->fixedClock(0),
            sleeper: $sleeper,
            maxAttempts: self::TEST_MAX_ATTEMPTS,
            baseDelayMs: self::TEST_BASE_DELAY_MS,
            maxDelayMs: self::TEST_MAX_DELAY_MS,
        );
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('not rewindable');
        $client->sendRequest($request);
    }

    public function testExponentialFallbackWhenNoRetryAfter(): void
    {
        $factory = new Psr17Factory();
        $sleeper = $this->recordingSleeper();
        $client = new RetryClient(
            inner: $this->scriptedClient([
                ['status' => 503],
                ['status' => 503],
                ['status' => 200],
            ], $factory),
            clock: $this->fixedClock(0),
            sleeper: $sleeper,
            maxAttempts: self::TEST_MAX_ATTEMPTS,
            baseDelayMs: self::TEST_BASE_DELAY_MS,
            maxDelayMs: self::TEST_MAX_DELAY_MS,
        );
        $client->sendRequest($factory->createRequest('GET', 'http://example/v1/x'));
        self::assertSame([self::TEST_BASE_DELAY_MS, self::TEST_BASE_DELAY_MS * 2], $sleeper->calls);
    }

    public function testExhaustsAttemptsAndRethrows(): void
    {
        $factory = new Psr17Factory();
        $sleeper = $this->recordingSleeper();
        $error = new RuntimeException('connection reset');
        $client = new RetryClient(
            inner: $this->scriptedClient(array_fill(0, self::TEST_MAX_ATTEMPTS, ['exception' => $error]), $factory),
            clock: $this->fixedClock(0),
            sleeper: $sleeper,
            maxAttempts: self::TEST_MAX_ATTEMPTS,
            baseDelayMs: self::TEST_BASE_DELAY_MS,
            maxDelayMs: self::TEST_MAX_DELAY_MS,
        );
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('connection reset');
        $client->sendRequest($factory->createRequest('GET', 'http://example/v1/x'));
    }

    public function testParseRetryAfterRejectsNegative(): void
    {
        self::assertNull(RetryClient::parseRetryAfter('-5', 0));
    }

    public function testParseRetryAfterRejectsGarbage(): void
    {
        self::assertNull(RetryClient::parseRetryAfter('not-a-date', 0));
    }

    public function testParseRetryAfterAcceptsHttpDate(): void
    {
        $nowMs = 1_700_000_000_000;
        $httpDate = gmdate('D, d M Y H:i:s', (int) ($nowMs / 1000) + 5) . ' GMT';
        $result = RetryClient::parseRetryAfter($httpDate, $nowMs);
        self::assertNotNull($result);
        self::assertGreaterThanOrEqual(4_000, $result);
        self::assertLessThanOrEqual(6_000, $result);
    }
}
