<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Core;

use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use GuzzleHttp\Psr7\NoSeekStream;
use GuzzleHttp\Psr7\Utils;
use Nyholm\Psr7\Factory\Psr17Factory;
use Nyholm\Psr7\Response;
use PHPUnit\Framework\TestCase;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use Sah\Sdk\Core\Clock;
use Sah\Sdk\Core\SessionInterceptor;
use Sah\Sdk\Core\SessionStore;
use Sah\Sdk\Zyins\SignRequest;

final class SessionInterceptorTest extends TestCase
{
    /**
     * 10 sequential product calls from a cold-start interceptor must
     * trigger exactly one POST /v1/sessions. PHP is single-threaded
     * per worker, so single-flight here is the "double-checked"
     * invariant: the second call hits the cache.
     */
    public function testSequentialProductCallsTriggerExactlyOneBootstrap(): void
    {
        $transport = new RecordingClient();
        $store = $this->newStore($transport);
        $interceptor = new SessionInterceptor($store, $transport);
        $factory = new Psr17Factory();
        for ($i = 0; $i < 10; ++$i) {
            $request = $factory
                ->createRequest('POST', 'https://api.example.test/v1/prequalify')
                ->withHeader('Content-Type', 'application/json')
                ->withBody($factory->createStream('{"x":1}'));
            $resp = $interceptor->sendRequest($request);
            self::assertSame(200, $resp->getStatusCode());
        }
        self::assertSame(1, $transport->bootstrapHits, 'single-flight violated');
        self::assertSame(10, $transport->productHits);
        self::assertSame(array_fill(0, 10, '{"x":1}'), $transport->productBodies);
        self::assertSame(1, $store->bootstrapCount());
    }

    public function testRetryOn401SessionExpired(): void
    {
        $transport = new RecordingClient();
        $transport->expireNextProduct = true;
        $store = $this->newStore($transport);
        $interceptor = new SessionInterceptor($store, $transport);
        $factory = new Psr17Factory();
        $request = $factory
            ->createRequest('POST', 'https://api.example.test/v1/prequalify')
            ->withBody($factory->createStream('{"x":1}'));
        $resp = $interceptor->sendRequest($request);
        self::assertSame(200, $resp->getStatusCode());
        self::assertSame(2, $transport->bootstrapHits);
        self::assertSame(2, $transport->productHits);
        self::assertSame(['{"x":1}', '{"x":1}'], $transport->productBodies);
    }

    public function testQueryStringIsIncludedInSessionSignature(): void
    {
        $transport = new RecordingClient();
        $store = $this->newStore($transport);
        $interceptor = new SessionInterceptor($store, $transport);
        $factory = new Psr17Factory();
        $request = $factory
            ->createRequest('POST', 'https://api.example.test/v1/prequalify?foo=bar')
            ->withBody($factory->createStream('{"x":1}'));

        $interceptor->sendRequest($request);

        $expected = SignRequest::sign(
            'POST',
            '/v1/prequalify?foo=bar',
            '{"x":1}',
            'sess_test_01HZK2N5GQR9T8X4B6FJW3Y1AS',
            'secret_test_4fjK2nQ7mX1aB8sR9pZ3',
            new DateTimeImmutable($transport->productTimestamps[0]),
        );
        self::assertSame($expected['X-Isa-Signature'], $transport->productSignatures[0]);
    }

    public function testNonExpired401KeepsNonSeekableBodyReadable(): void
    {
        $transport = new RecordingClient();
        $transport->invalidTokenNextProduct = true;
        $store = $this->newStore($transport);
        $interceptor = new SessionInterceptor($store, $transport);
        $factory = new Psr17Factory();
        $request = $factory
            ->createRequest('POST', 'https://api.example.test/v1/prequalify')
            ->withBody($factory->createStream('{"x":1}'));

        $resp = $interceptor->sendRequest($request);

        self::assertSame(401, $resp->getStatusCode());
        self::assertSame('{"code":"invalid_token"}', (string) $resp->getBody());
    }

    public function testOnActivityColdStartBootstraps(): void
    {
        $transport = new RecordingClient();
        $store = $this->newStore($transport);
        $store->onActivity();
        self::assertSame(1, $transport->bootstrapHits);
        self::assertNotNull($store->currentSecret());
    }

    private function newStore(RecordingClient $transport): SessionStore
    {
        $factory = new Psr17Factory();
        return new SessionStore(
            $transport,
            $factory,
            $factory,
            new FixedClock(new DateTimeImmutable('2026-05-21T12:00:00Z', new DateTimeZone('UTC'))),
            'https://api.example.test',
            'SDV-HWH-WDD',
            'john.doe@acme-agency.com',
            'zyins_test_4fjK2nQ7mX1aB8sR9pZ3',
            'device-abc-123',
        );
    }
}

final class FixedClock implements Clock
{
    public function __construct(private DateTimeImmutable $now)
    {
    }

    public function nowMilliseconds(): int
    {
        return $this->now->getTimestamp() * 1000;
    }
}

final class RecordingClient implements ClientInterface
{
    public int $bootstrapHits = 0;
    public int $productHits = 0;
    /** @var list<string> */
    public array $productBodies = [];
    /** @var list<string> */
    public array $productSignatures = [];
    /** @var list<string> */
    public array $productTimestamps = [];
    public bool $expireNextProduct = false;
    public bool $invalidTokenNextProduct = false;

    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        $factory = new Psr17Factory();
        $path = $request->getUri()->getPath();
        if (str_ends_with($path, '/v1/sessions')) {
            ++$this->bootstrapHits;
            $expires = (new DateTimeImmutable('2026-05-21T12:00:00Z', new DateTimeZone('UTC')))
                ->add(new DateInterval('PT24H'));
            $body = json_encode([
                'data' => [
                    'sessionId' => 'sess_test_01HZK2N5GQR9T8X4B6FJW3Y1AS',
                    'sessionSecret' => 'secret_test_4fjK2nQ7mX1aB8sR9pZ3',
                    'expiresAt' => $expires->format('Y-m-d\TH:i:s\Z'),
                ],
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            return new Response(
                200,
                ['Content-Type' => 'application/json'],
                $body,
            );
        }
        ++$this->productHits;
        $this->productBodies[] = (string) $request->getBody();
        $this->productSignatures[] = $request->getHeaderLine('X-Isa-Signature');
        $this->productTimestamps[] = $request->getHeaderLine('X-Isa-Timestamp');
        if ($this->expireNextProduct) {
            $this->expireNextProduct = false;
            return new Response(
                401,
                ['Content-Type' => 'application/problem+json'],
                json_encode(['code' => 'session_expired', 'type' => 'about:blank'], JSON_THROW_ON_ERROR),
            );
        }
        if ($this->invalidTokenNextProduct) {
            $this->invalidTokenNextProduct = false;
            return new Response(
                401,
                ['Content-Type' => 'application/problem+json'],
                new NoSeekStream(Utils::streamFor('{"code":"invalid_token"}')),
            );
        }
        return new Response(200, ['Content-Type' => 'application/json'], '{"ok":true}');
    }
}
