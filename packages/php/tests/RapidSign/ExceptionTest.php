<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\RapidSign;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\RapidSign\Exception\BadGatewayException;
use Isa\Sdk\RapidSign\Exception\ConflictException;
use Isa\Sdk\RapidSign\Exception\DeadlineExceededException;
use Isa\Sdk\RapidSign\Exception\ErrorFactory;
use Isa\Sdk\RapidSign\Exception\ForbiddenException;
use Isa\Sdk\RapidSign\Exception\GatewayTimeoutException;
use Isa\Sdk\RapidSign\Exception\InternalErrorException;
use Isa\Sdk\RapidSign\Exception\InvalidTokenException;
use Isa\Sdk\RapidSign\Exception\LicenseLockedException;
use Isa\Sdk\RapidSign\Exception\MethodNotAllowedException;
use Isa\Sdk\RapidSign\Exception\NotFoundException;
use Isa\Sdk\RapidSign\Exception\NotImplementedException;
use Isa\Sdk\RapidSign\Exception\RapidSignException;
use Isa\Sdk\RapidSign\Exception\RateLimitedException;
use Isa\Sdk\RapidSign\Exception\ServiceUnavailableException;
use Isa\Sdk\RapidSign\Exception\TokenExpiredException;
use Isa\Sdk\RapidSign\Exception\UnauthorizedException;
use Isa\Sdk\RapidSign\Exception\UnknownException;
use Isa\Sdk\RapidSign\Exception\ValidationException;

#[CoversClass(ErrorFactory::class)]
#[CoversClass(RapidSignException::class)]
#[CoversClass(UnauthorizedException::class)]
#[CoversClass(TokenExpiredException::class)]
#[CoversClass(InvalidTokenException::class)]
#[CoversClass(ForbiddenException::class)]
#[CoversClass(NotFoundException::class)]
#[CoversClass(MethodNotAllowedException::class)]
#[CoversClass(ConflictException::class)]
#[CoversClass(ValidationException::class)]
#[CoversClass(LicenseLockedException::class)]
#[CoversClass(RateLimitedException::class)]
#[CoversClass(InternalErrorException::class)]
#[CoversClass(BadGatewayException::class)]
#[CoversClass(GatewayTimeoutException::class)]
#[CoversClass(ServiceUnavailableException::class)]
#[CoversClass(DeadlineExceededException::class)]
#[CoversClass(NotImplementedException::class)]
#[CoversClass(UnknownException::class)]
final class ExceptionTest extends TestCase
{
    /**
     * @return iterable<string,array{0:string,1:int,2:class-string<RapidSignException>}>
     */
    public static function codeMappings(): iterable
    {
        yield 'unauthorized' => ['unauthorized', 401, UnauthorizedException::class];
        yield 'token_expired' => ['token_expired', 401, TokenExpiredException::class];
        yield 'invalid_token' => ['invalid_token', 401, InvalidTokenException::class];
        yield 'forbidden' => ['forbidden', 403, ForbiddenException::class];
        yield 'not_found' => ['not_found', 404, NotFoundException::class];
        yield 'method_not_allowed' => ['method_not_allowed', 405, MethodNotAllowedException::class];
        yield 'conflict' => ['conflict', 409, ConflictException::class];
        yield 'validation_error' => ['validation_error', 400, ValidationException::class];
        yield 'license_locked' => ['license_locked', 423, LicenseLockedException::class];
        yield 'rate_limit_exceeded' => ['rate_limit_exceeded', 429, RateLimitedException::class];
        yield 'rate_limited' => ['rate_limited', 429, RateLimitedException::class];
        yield 'internal_error' => ['internal_error', 500, InternalErrorException::class];
        yield 'bad_gateway' => ['bad_gateway', 502, BadGatewayException::class];
        yield 'gateway_timeout' => ['gateway_timeout', 504, GatewayTimeoutException::class];
        yield 'service_unavailable' => ['service_unavailable', 503, ServiceUnavailableException::class];
        yield 'not_implemented' => ['not_implemented', 501, NotImplementedException::class];
    }

    /**
     * @param class-string<RapidSignException> $class
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('codeMappings')]
    public function testProblemDetailsMapsToCorrectSubclass(string $code, int $status, string $class): void
    {
        $body = json_encode([
            'title' => 'err',
            'status' => $status,
            'code' => $code,
            'detail' => 'something went wrong',
            'request_id' => 'req_test',
        ], JSON_THROW_ON_ERROR);

        $err = ErrorFactory::fromHttpResponse($status, $body, []);
        self::assertInstanceOf($class, $err);
        self::assertSame($code, $err->code());
        self::assertSame('req_test', $err->requestId());
    }

    public function testValidationErrorCarriesParam(): void
    {
        $body = json_encode([
            'title' => 'Bad Request',
            'status' => 400,
            'code' => 'validation_error',
            'detail' => 'email is required',
            'param' => '/recipient/email',
        ], JSON_THROW_ON_ERROR);

        $err = ErrorFactory::fromHttpResponse(400, $body, []);
        self::assertInstanceOf(ValidationException::class, $err);
        self::assertSame('/recipient/email', $err->param());
    }

    public function testRateLimitedExtractsRetryAfterHeader(): void
    {
        $err = ErrorFactory::fromHttpResponse(
            429,
            '{"title":"too many","status":429,"code":"rate_limit_exceeded"}',
            ['retry-after' => ['7']],
        );
        self::assertInstanceOf(RateLimitedException::class, $err);
        self::assertTrue($err->retryable());
        self::assertSame(7_000, $err->retryAfterMs());
    }

    public function testFallbackToStatusWhenBodyNotProblemDetails(): void
    {
        $err = ErrorFactory::fromHttpResponse(503, 'plain text upstream failure', []);
        self::assertInstanceOf(ServiceUnavailableException::class, $err);
        self::assertTrue($err->retryable());
    }

    public function testUnknownExceptionForUnmappedStatus(): void
    {
        $err = ErrorFactory::fromHttpResponse(418, '', []);
        self::assertInstanceOf(UnknownException::class, $err);
        self::assertSame('unknown', $err->code());
    }

    public function testInternalErrorIsRetryable(): void
    {
        $err = new InternalErrorException('boom');
        self::assertTrue($err->retryable());
    }


    public function testServiceUnavailableExtractsRetryAfterHeader(): void
    {
        $err = ErrorFactory::fromHttpResponse(
            503,
            '{"title":"unavailable","status":503,"code":"service_unavailable"}',
            ['retry-after' => ['300']],
        );
        self::assertInstanceOf(ServiceUnavailableException::class, $err);
        self::assertSame(300_000, $err->retryAfterMs());
    }

    public function testUnknownProblemCodePreservesWireCode(): void
    {
        $body = json_encode([
            'title' => 'Future',
            'status' => 400,
            'code' => 'future_error_code',
            'detail' => 'not mapped yet',
        ], JSON_THROW_ON_ERROR);

        $err = ErrorFactory::fromHttpResponse(400, $body, []);
        self::assertInstanceOf(UnknownException::class, $err);
        self::assertSame('future_error_code', $err->code());
    }

    public function testDeadlineExceededCarriesNoRetry(): void
    {
        $err = new DeadlineExceededException('timed out');
        self::assertFalse($err->retryable());
        self::assertSame('deadline_exceeded', $err->code());
    }
}
