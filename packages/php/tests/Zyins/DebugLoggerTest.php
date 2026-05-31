<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins;

use Nyholm\Psr7\Request;
use Nyholm\Psr7\Response;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Psr\Log\AbstractLogger;
use Isa\Sdk\Zyins\Logging\DebugLogger;

#[CoversClass(DebugLogger::class)]
final class DebugLoggerTest extends TestCase
{
    private string|false $priorEnv;

    protected function setUp(): void
    {
        $this->priorEnv = getenv(DebugLogger::ENV_VAR);
        putenv(DebugLogger::ENV_VAR);
    }

    protected function tearDown(): void
    {
        if ($this->priorEnv === false) {
            putenv(DebugLogger::ENV_VAR);
        } else {
            putenv(DebugLogger::ENV_VAR . '=' . $this->priorEnv);
        }
    }

    public function testDisabledByDefault(): void
    {
        $logger = new DebugLogger();
        self::assertFalse($logger->isEnabled());
    }

    public function testEnabledByEnvVar(): void
    {
        putenv(DebugLogger::ENV_VAR . '=' . DebugLogger::ENV_VALUE);
        $logger = new DebugLogger();
        self::assertTrue($logger->isEnabled());
    }

    public function testEnabledByExplicitPsr3Logger(): void
    {
        $logger = new DebugLogger(new InMemoryLogger());
        self::assertTrue($logger->isEnabled());
    }

    public function testPsr3LoggerRedactsAuthHeader(): void
    {
        $captured = new InMemoryLogger();
        $logger = new DebugLogger($captured);

        $bodyJson = json_encode(['applicant' => ['email' => 'john@example.com', 'dob' => '1962-04-18']], JSON_THROW_ON_ERROR);
        $request = new Request(
            'POST',
            'https://api.isaapi.com/v1/prequalify',
            [
                'Authorization' => 'Bearer isa_live_SECRET_TOKEN_VALUE',
                'X-Device-Signature' => 'deadbeefcafef00d',
                'Content-Type' => 'application/json',
            ],
            $bodyJson,
        );

        $logger->logRequest($request);

        self::assertCount(1, $captured->records);
        $record = $captured->records[0];
        self::assertSame('isa-sdk request', $record['message']);

        /** @var array<string,array<int,string>> $headers */
        $headers = $record['context']['headers'];
        self::assertSame(['[redacted]'], $headers['Authorization']);
        self::assertSame(['[redacted]'], $headers['X-Device-Signature']);
        self::assertSame(['application/json'], $headers['Content-Type']);

        /** @var array{applicant: array{email: string, dob: string}} $body */
        $body = $record['context']['body'];
        self::assertIsArray($body);
        self::assertSame('[redacted]', $body['applicant']['email']);
        self::assertSame('[redacted]', $body['applicant']['dob']);
    }

    public function testRedactsResponseBody(): void
    {
        $captured = new InMemoryLogger();
        $logger = new DebugLogger($captured);

        $request = new Request('POST', 'https://api.isaapi.com/v1/sessions');
        $respBody = json_encode([
            'data' => [
                'licenseKey' => 'isa_license_SECRET',
                'phone' => '+15555550100',
                'safe' => 'value',
                'ssn' => '123-45-6789',
            ],
        ], JSON_THROW_ON_ERROR);
        $response = new Response(200, ['Content-Type' => 'application/json'], $respBody);

        $logger->logResponse($response, $request);

        /** @var array{data: array{licenseKey: string, ssn: string, phone: string, safe: string}} $body */
        $body = $captured->records[0]['context']['body'];
        self::assertSame('[redacted]', $body['data']['licenseKey']);
        self::assertSame('[redacted]', $body['data']['ssn']);
        self::assertSame('[redacted]', $body['data']['phone']);
        self::assertSame('value', $body['data']['safe']);
    }

    public function testStderrEmissionDoesNotTouchStdout(): void
    {
        putenv(DebugLogger::ENV_VAR . '=' . DebugLogger::ENV_VALUE);
        $logger = new DebugLogger();
        $request = new Request('POST', 'https://api.isaapi.com/v1/prequalify');

        ob_start();
        $logger->logRequest($request);
        $stdout = ob_get_clean();

        // The contract: never write to stdout. Even when the env-var
        // path is taken, stdout stays clean — parent/child JSON
        // pipelines remain parseable.
        self::assertSame('', $stdout);
    }
}

/**
 * Minimal PSR-3 logger that retains every record for assertion.
 */
final class InMemoryLogger extends AbstractLogger
{
    /** @var array<int,array{level: mixed, message: string, context: array<string,mixed>}> */
    public array $records = [];

    /**
     * @param mixed $level
     * @param string|\Stringable $message
     * @param array<mixed> $context
     */
    public function log($level, string|\Stringable $message, array $context = []): void
    {
        $this->records[] = [
            'level' => $level,
            'message' => (string) $message,
            'context' => $context,
        ];
    }
}
