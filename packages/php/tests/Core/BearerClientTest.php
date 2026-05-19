<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Core;

use InvalidArgumentException;
use Nyholm\Psr7\Factory\Psr17Factory;
use PHPUnit\Framework\TestCase;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use RuntimeException;
use Sah\Sdk\Core\BearerClient;
use Sah\Sdk\Core\StaticToken;
use Sah\Sdk\Core\TokenSource;

final class BearerClientTest extends TestCase
{
    private function recordingClient(?RequestInterface &$capture, ?ResponseInterface $response = null): ClientInterface
    {
        return new class ($capture, $response) implements ClientInterface {
            public function __construct(
                private ?RequestInterface &$capture,
                private ?ResponseInterface $response,
            ) {
            }

            public function sendRequest(RequestInterface $request): ResponseInterface
            {
                $this->capture = $request;
                $factory = new Psr17Factory();
                return $this->response ?? $factory->createResponse(200);
            }
        };
    }

    public function testStaticTokenRejectsEmptyValue(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new StaticToken('');
    }

    public function testStaticTokenReturnsValue(): void
    {
        self::assertSame('abc', (new StaticToken('abc'))->token());
    }

    public function testBearerClientAttachesAuthorizationHeader(): void
    {
        $factory = new Psr17Factory();
        $capture = null;
        $client = new BearerClient(new StaticToken('secret'), $this->recordingClient($capture));
        $client->sendRequest($factory->createRequest('GET', 'http://example/v1/x'));
        self::assertNotNull($capture);
        self::assertSame('Bearer secret', $capture->getHeaderLine('Authorization'));
    }

    public function testBearerClientOverwritesPreExistingHeader(): void
    {
        $factory = new Psr17Factory();
        $capture = null;
        $client = new BearerClient(new StaticToken('new'), $this->recordingClient($capture));
        $request = $factory->createRequest('GET', 'http://example/v1/x')->withHeader('Authorization', 'Bearer old');
        $client->sendRequest($request);
        self::assertSame('Bearer new', $capture->getHeaderLine('Authorization'));
    }

    public function testBearerClientPropagatesTokenSourceException(): void
    {
        $factory = new Psr17Factory();
        $source = new class () implements TokenSource {
            public function token(): string
            {
                throw new RuntimeException('token oracle offline');
            }
        };
        $capture = null;
        $client = new BearerClient($source, $this->recordingClient($capture));
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('token oracle offline');
        $client->sendRequest($factory->createRequest('GET', 'http://example/v1/x'));
    }
}
