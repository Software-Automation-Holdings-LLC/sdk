<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Proxy\Call;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\Proxy\Auth;
use Isa\Sdk\Proxy\Call\InvokeInput;
use Isa\Sdk\Proxy\Call\InvokeResult;
use Isa\Sdk\Proxy\Call\Service as CallService;
use Isa\Sdk\Proxy\DecodedResponse;
use Isa\Sdk\Proxy\Exception\IntegrationNotFoundException;
use Isa\Sdk\Proxy\Exception\ProxyAuthException;
use Isa\Sdk\Proxy\Exception\ProxyException;
use Isa\Sdk\Proxy\Exception\ProxyRateLimitException;
use Isa\Sdk\Proxy\Exception\ProxyValidationException;
use Isa\Sdk\Proxy\RequestOptions;
use Isa\Sdk\Proxy\Transport;
use Isa\Sdk\Tests\Proxy\Support\FixedKeySource;
use Isa\Sdk\Tests\Proxy\Support\MockHttpClient;

#[CoversClass(CallService::class)]
#[CoversClass(InvokeInput::class)]
#[CoversClass(InvokeResult::class)]
#[CoversClass(Transport::class)]
#[CoversClass(DecodedResponse::class)]
final class ServiceTest extends TestCase
{
    private function makeService(MockHttpClient $http): CallService
    {
        $transport = new Transport(
            http: $http,
            auth: new Auth('isa_test_4fjK2nQ7mX1aB8sR9pZ3'),
            keys: new FixedKeySource('550e8400-e29b-41d4-a716-446655440000'),
            baseUrl: 'https://proxy.example.test',
            apiVersion: '2026-05-18',
            userAgent: 'test-agent',
        );
        return new CallService($transport);
    }

    public function testInvokeSendsEnvelopeAndDecodesResponse(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'data' => [
                'status' => 201,
                'headers' => ['Content-Type' => 'application/json'],
                'body' => ['ok' => true],
            ],
            'request_id' => 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
        ], JSON_THROW_ON_ERROR));

        $svc = $this->makeService($http);
        $result = $svc->invoke(
            'int_01HZK2N5GQR9T8X4B6FJW3Y1AS',
            new InvokeInput(
                method: 'POST',
                path: '/api/v1/quote',
                headers: ['X-Demo' => 'yes'],
                body: ['date_of_birth' => '1962-04-18'],
            ),
        );

        $this->assertSame(201, $result->status);
        $this->assertSame('application/json', $result->headers['Content-Type']);
        $this->assertSame(['ok' => true], $result->body);
        $this->assertSame('req_01HZK2N5GQR9T8X4B6FJW3Y1AS', $result->requestId);

        $req = $http->lastRequest();
        $this->assertSame('POST', $req->getMethod());
        $this->assertSame('https://proxy.example.test/v1/call', (string) $req->getUri());
        $this->assertSame('Bearer isa_test_4fjK2nQ7mX1aB8sR9pZ3', $req->getHeaderLine('Authorization'));
        $this->assertSame('550e8400-e29b-41d4-a716-446655440000', $req->getHeaderLine('Idempotency-Key'));
        $this->assertSame('2026-05-18', $req->getHeaderLine('Version'));

        $decoded = json_decode((string) $req->getBody(), associative: true);
        $this->assertSame('int_01HZK2N5GQR9T8X4B6FJW3Y1AS', $decoded['integration_id']);
        $this->assertSame('POST', $decoded['params']['method']);
        $this->assertSame('/api/v1/quote', $decoded['params']['path']);
        $this->assertSame(['X-Demo' => 'yes'], $decoded['params']['headers']);
        $this->assertSame(['date_of_birth' => '1962-04-18'], $decoded['params']['body']);
    }

    public function testRequestOptionsOverrideIdempotencyAndVersion(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"data":{"status":204,"headers":{},"body":null}}');
        $svc = $this->makeService($http);
        $svc->invoke(
            'int_x',
            new InvokeInput(method: 'GET', path: '/p'),
            RequestOptions::default()
                ->withIdempotencyKey('explicit-key-123')
                ->withVersion('2026-06-01')
        );
        $req = $http->lastRequest();
        $this->assertSame('explicit-key-123', $req->getHeaderLine('Idempotency-Key'));
        $this->assertSame('2026-06-01', $req->getHeaderLine('Version'));
    }

    public function testAuthErrorMappedToProxyAuthException(): void
    {
        $http = new MockHttpClient();
        $http->queue(401, '{"code":"unauthorized","detail":"bad token","request_id":"req_x"}');
        $svc = $this->makeService($http);
        try {
            $svc->invoke('int_x', new InvokeInput(method: 'POST', path: '/p'));
            $this->fail('expected ProxyAuthException');
        } catch (ProxyAuthException $e) {
            $this->assertSame('unauthorized', $e->code());
            $this->assertSame(401, $e->httpStatus());
            $this->assertSame('req_x', $e->requestId());
        }
    }

    public function testValidationErrorMappedToProxyValidationException(): void
    {
        $http = new MockHttpClient();
        $http->queue(400, '{"code":"validation_error","detail":"bad","details":{"path":"required"},"param":"path"}');
        $svc = $this->makeService($http);
        try {
            $svc->invoke('int_x', new InvokeInput(method: 'POST', path: ''));
            $this->fail('expected ProxyValidationException');
        } catch (ProxyValidationException $e) {
            $this->assertSame('validation_error', $e->code());
            $this->assertSame('path', $e->param());
            $this->assertSame(['path' => 'required'], $e->details());
        }
    }

    public function testRateLimitErrorMappedWithRetryAfter(): void
    {
        $http = new MockHttpClient();
        $http->queue(429, '{"code":"rate_limited","detail":"slow down"}', ['Retry-After' => '7']);
        $svc = $this->makeService($http);
        try {
            $svc->invoke('int_x', new InvokeInput(method: 'POST', path: '/p'));
            $this->fail('expected ProxyRateLimitException');
        } catch (ProxyRateLimitException $e) {
            $this->assertSame(7, $e->retryAfterSeconds());
        }
    }

    public function testNotFoundMappedToIntegrationNotFoundException(): void
    {
        $http = new MockHttpClient();
        $http->queue(404, '{"code":"integration_not_found","detail":"no such integration"}');
        $svc = $this->makeService($http);
        $this->expectException(IntegrationNotFoundException::class);
        $svc->invoke('int_missing', new InvokeInput(method: 'POST', path: '/p'));
    }

    public function testGenericNotFoundWithoutCodeMapsToProxyException(): void
    {
        $http = new MockHttpClient();
        $http->queue(404, 'Not Found');
        $svc = $this->makeService($http);
        try {
            $svc->invoke('int_x', new InvokeInput(method: 'POST', path: '/p'));
            $this->fail('expected ProxyException');
        } catch (ProxyException $e) {
            $this->assertNotInstanceOf(IntegrationNotFoundException::class, $e);
            $this->assertSame('unknown', $e->code());
            $this->assertSame(404, $e->httpStatus());
        }
    }

    public function testValidationErrorPreservesUpstreamCode(): void
    {
        $http = new MockHttpClient();
        $http->queue(400, '{"code":"invalid_param","detail":"bad","param":"path"}');
        $svc = $this->makeService($http);
        try {
            $svc->invoke('int_x', new InvokeInput(method: 'POST', path: ''));
            $this->fail('expected ProxyValidationException');
        } catch (ProxyValidationException $e) {
            $this->assertSame('invalid_param', $e->code());
        }
    }

    public function testUnprocessableEntityMapsToValidationException(): void
    {
        $http = new MockHttpClient();
        $http->queue(422, '{"code":"validation_error","detail":"bad","param":"path","doc_url":"https://docs.example/v","advice_code":"fix_path"}');
        $svc = $this->makeService($http);
        try {
            $svc->invoke('int_x', new InvokeInput(method: 'POST', path: ''));
            $this->fail('expected ProxyValidationException');
        } catch (ProxyValidationException $e) {
            $this->assertSame('validation_error', $e->code());
            $this->assertSame(422, $e->httpStatus());
            $this->assertSame('https://docs.example/v', $e->docUrl());
            $this->assertSame('fix_path', $e->adviceCode());
        } catch (ProxyException $e) {
            $this->fail('expected ProxyValidationException, got ' . $e::class);
        }
    }

    public function testMalformedSuccessJsonRaisesProxyException(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{not-json');
        $svc = $this->makeService($http);
        try {
            $svc->invoke('int_x', new InvokeInput(method: 'POST', path: '/p'));
            $this->fail('expected ProxyException');
        } catch (ProxyException $e) {
            $this->assertSame('invalid_response', $e->code());
        }
    }

    public function testEmptyJsonObjectResponseIsDecoded(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{}');
        $svc = $this->makeService($http);
        try {
            $svc->invoke('int_x', new InvokeInput(method: 'GET', path: '/p'));
            $this->fail('expected ProxyException');
        } catch (ProxyException $e) {
            $this->assertStringContainsString('missing integer status', $e->getMessage());
        }
    }

    public function testTopLevelJsonArrayResponseRejected(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '[1,2]');
        $svc = $this->makeService($http);
        try {
            $svc->invoke('int_x', new InvokeInput(method: 'GET', path: '/p'));
            $this->fail('expected ProxyException');
        } catch (ProxyException $e) {
            $this->assertSame('invalid_response', $e->code());
            $this->assertStringContainsString('not a JSON object', $e->getMessage());
        }
    }

    public function testInvokePreservesScalarDownstreamBody(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'data' => [
                'status' => 200,
                'headers' => [],
                'body' => true,
            ],
        ], JSON_THROW_ON_ERROR));
        $svc = $this->makeService($http);
        $result = $svc->invoke(
            'int_x',
            new InvokeInput(method: 'GET', path: '/p'),
        );
        $this->assertTrue($result->body);
    }
}
