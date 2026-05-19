<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Proxy;

use InvalidArgumentException;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\Proxy\Auth;
use Sah\Sdk\Proxy\ProxyClient;

#[CoversClass(ProxyClient::class)]
#[CoversClass(Auth::class)]
final class ProxyClientTest extends TestCase
{
    public function testConstructorWiresServicesFromTokenAlone(): void
    {
        $client = new ProxyClient('isa_test_4fjK2nQ7mX1aB8sR9pZ3');
        $this->assertTrue($client->auth->isTest());
        $this->assertFalse($client->auth->isLive());
        $this->assertTrue($client->auth->isRecognizedPrefix());
        $this->assertNotNull($client->call);
        $this->assertNotNull($client->algosure);
    }

    public function testEmptyTokenRejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new ProxyClient('');
    }

    public function testUnrecognizedPrefixIsAccepted(): void
    {
        $client = new ProxyClient('something_else_xxxx');
        $this->assertFalse($client->auth->isRecognizedPrefix());
        $this->assertSame('Bearer something_else_xxxx', $client->auth->authorizationHeader());
    }
}
