<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Logos;

use InvalidArgumentException;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Exception\IsaException;
use Isa\Sdk\Zyins\Logos\Service;

#[CoversClass(Service::class)]
final class ServiceTest extends TestCase
{
    public function testGetReturnsRawBytesByDefault(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, "\x89PNG\r\n\x1a\n", ['Content-Type' => 'image/png']);
        $svc = new Service(http: $http, baseUrl: 'https://zyins.isaapi.com');

        $bytes = $svc->get('aetna');
        self::assertStringStartsWith("\x89PNG", $bytes);
        $request = $http->lastRequest();
        self::assertSame('GET', $request->getMethod());
        self::assertStringContainsString('/v1/logo/aetna', (string) $request->getUri());
        self::assertStringNotContainsString('?ds=', (string) $request->getUri());
    }

    public function testGetReturnsDataUriWhenRequested(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, 'data:image/png;base64,iVBORw0KGgo=', ['Content-Type' => 'text/plain']);
        $svc = new Service(http: $http, baseUrl: 'https://zyins.isaapi.com');

        $uri = $svc->get('aetna', ['dataUri' => true]);
        self::assertStringStartsWith('data:image/png;base64,', $uri);
        self::assertStringContainsString('?ds=true', (string) $http->lastRequest()->getUri());
    }

    public function testGetRejectsEmptyCarrier(): void
    {
        $svc = new Service(http: new MockHttpClient());
        $this->expectException(InvalidArgumentException::class);
        $svc->get('');
    }

    public function testGet404SurfacesNotFound(): void
    {
        $http = new MockHttpClient();
        $http->queue(404, 'logo not found for carrier');
        $svc = new Service(http: $http);
        $this->expectException(IsaException::class);
        $this->expectExceptionMessage('logo not found');
        $svc->get('does-not-exist');
    }

    public function testDataUriValidationRejectsNonDataBody(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '<html>oops</html>');
        $svc = new Service(http: $http);
        $this->expectException(IsaException::class);
        $svc->get('aetna', ['dataUri' => true]);
    }
}
