<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Proxy\Exception;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\Proxy\Exception\AlgosureException;
use Sah\Sdk\Proxy\Exception\IntegrationNotFoundException;
use Sah\Sdk\Proxy\Exception\IsaException;
use Sah\Sdk\Proxy\Exception\ProxyAuthException;
use Sah\Sdk\Proxy\Exception\ProxyException;
use Sah\Sdk\Proxy\Exception\ProxyRateLimitException;
use Sah\Sdk\Proxy\Exception\ProxyValidationException;

#[CoversClass(IsaException::class)]
#[CoversClass(ProxyException::class)]
#[CoversClass(ProxyAuthException::class)]
#[CoversClass(ProxyRateLimitException::class)]
#[CoversClass(ProxyValidationException::class)]
#[CoversClass(IntegrationNotFoundException::class)]
#[CoversClass(AlgosureException::class)]
final class ExceptionTest extends TestCase
{
    public function testIsaExceptionExposesEveryField(): void
    {
        $e = new IsaException(
            message: 'boom',
            errorCode: 'invalid',
            httpStatus: 422,
            requestId: 'req_y',
            adviceCode: 'retry',
            docUrl: 'https://docs.example/x',
            param: 'foo',
        );
        $this->assertSame('boom', $e->getMessage());
        $this->assertSame('invalid', $e->code());
        $this->assertSame(422, $e->httpStatus());
        $this->assertSame('req_y', $e->requestId());
        $this->assertSame('retry', $e->adviceCode());
        $this->assertSame('https://docs.example/x', $e->docUrl());
        $this->assertSame('foo', $e->param());
    }

    public function testRateLimitExceptionCarriesRetryAfter(): void
    {
        $e = new ProxyRateLimitException('slow', 429, 'req_z', 12);
        $this->assertSame('rate_limited', $e->code());
        $this->assertSame(12, $e->retryAfterSeconds());
    }

    public function testRateLimitExceptionForwardsDocUrlAndAdviceCode(): void
    {
        $e = new ProxyRateLimitException(
            'slow',
            429,
            'req_z',
            12,
            docUrl: 'https://docs.example/rate',
            adviceCode: 'backoff',
        );
        $this->assertSame('https://docs.example/rate', $e->docUrl());
        $this->assertSame('backoff', $e->adviceCode());
    }

    public function testValidationExceptionCarriesDetails(): void
    {
        $e = new ProxyValidationException('bad', 400, 'req', 'p', ['p' => 'required']);
        $this->assertSame('validation_error', $e->code());
        $this->assertSame(['p' => 'required'], $e->details());
    }

    public function testValidationExceptionPreservesUpstreamCode(): void
    {
        $e = new ProxyValidationException(
            'bad',
            400,
            'req',
            'p',
            [],
            errorCode: 'invalid_param',
        );
        $this->assertSame('invalid_param', $e->code());
    }

    public function testValidationExceptionForwardsDocUrlAndAdviceCode(): void
    {
        $e = new ProxyValidationException(
            message: 'bad',
            httpStatus: 422,
            requestId: 'req',
            param: 'p',
            details: ['p' => 'required'],
            docUrl: 'https://docs.example/validation',
            adviceCode: 'fix_field',
        );
        $this->assertSame('https://docs.example/validation', $e->docUrl());
        $this->assertSame('fix_field', $e->adviceCode());
    }

    public function testHierarchyIsCatchable(): void
    {
        $this->assertInstanceOf(ProxyException::class, new ProxyAuthException('x', 'forbidden'));
        $this->assertInstanceOf(IsaException::class, new ProxyException('x', 'y'));
        $this->assertInstanceOf(IsaException::class, new AlgosureException('x'));
        $this->assertInstanceOf(ProxyException::class, new IntegrationNotFoundException('x', 'integration_not_found'));
    }
}
