<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins;

use Isa\Sdk\Tests\Zyins\Support\MedicalRecordLog;
use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Prequalify\Input as PrequalifyInput;
use Isa\Sdk\Zyins\Prequalify\Service as PrequalifyService;
use Isa\Sdk\Zyins\Quote\Input as QuoteInput;
use Isa\Sdk\Zyins\Quote\Service as QuoteService;
use Isa\Sdk\Zyins\Reference\PrequalifyV3;
use Isa\Sdk\Zyins\Reference\QuoteV3;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Debug logging must not retain the underwriting record the client sends.
 *
 * These assertions fail while request and response bodies keep the
 * applicant's birth date, sex, build, location, conditions, and
 * medications. Omitting the body, or masking every key that is or
 * contains those wire names (including sex, the v3 prequalify name
 * for gender), makes them pass.
 */
final class DebugRedactionDisclosureTest extends TestCase
{
    /**
     * @return array<string, array{0: callable(PrequalifyService, PrequalifyInput): mixed}>
     */
    public static function v1PrequalifyCalls(): array
    {
        return [
            'run' => [static fn (PrequalifyService $service, PrequalifyInput $input) => $service->run($input)],
            'runWithRawResponse' => [static fn (PrequalifyService $service, PrequalifyInput $input) => $service->runWithRawResponse($input)],
            'legacyBlob' => [static fn (PrequalifyService $service, PrequalifyInput $input) => $service->legacyBlob($input->toWireBody())],
            'runEnvelope' => [static fn (PrequalifyService $service, PrequalifyInput $input) => $service->runEnvelope($input)],
        ];
    }

    /**
     * @return array<string, array{0: callable(QuoteService, QuoteInput): mixed}>
     */
    public static function v1QuoteCalls(): array
    {
        return [
            'run' => [static fn (QuoteService $service, QuoteInput $input) => $service->run($input)],
            'runEnvelope' => [static fn (QuoteService $service, QuoteInput $input) => $service->runEnvelope($input)],
        ];
    }

    public function testDefaultQuoteDebugLogOmitsMedicalRecord(): void
    {
        [$client, $log] = MedicalRecordLog::loggedClient(MedicalRecordLog::V3_OK);
        self::assertInstanceOf(QuoteV3::class, $client->quote);
        $client->quote->run(MedicalRecordLog::quoteV3Request());
        MedicalRecordLog::assertRecordAbsent($log);
    }

    public function testDefaultPrequalifyDebugLogOmitsMedicalRecord(): void
    {
        [$client, $log] = MedicalRecordLog::loggedClient(MedicalRecordLog::V3_OK);
        self::assertInstanceOf(PrequalifyV3::class, $client->prequalify);
        $client->prequalify->run(MedicalRecordLog::prequalifyV3Request());
        MedicalRecordLog::assertRecordAbsent($log);
    }

    #[DataProvider('v1PrequalifyCalls')]
    public function testV1PrequalifyDebugLogOmitsMedicalRecord(callable $call): void
    {
        [$client, $log] = MedicalRecordLog::loggedClient(MedicalRecordLog::V1_OK, ['prequalify' => 'v2']);
        self::assertInstanceOf(PrequalifyService::class, $client->prequalify);
        $call($client->prequalify, MedicalRecordLog::prequalifyInput());
        MedicalRecordLog::assertRecordAbsent($log);
    }

    #[DataProvider('v1QuoteCalls')]
    public function testV1QuoteDebugLogOmitsMedicalRecord(callable $call): void
    {
        [$client, $log] = MedicalRecordLog::loggedClient(MedicalRecordLog::V1_OK, ['quote' => 'v1']);
        self::assertInstanceOf(QuoteService::class, $client->quote);
        $call($client->quote, MedicalRecordLog::quoteInput());
        MedicalRecordLog::assertRecordAbsent($log);
    }

    public function testLegacyPrequalifyEnvelopeDebugLogOmitsMedicalRecord(): void
    {
        $this->withLegacyWire(function (): void {
            [$client, $log] = MedicalRecordLog::loggedClient(MedicalRecordLog::V1_OK, ['prequalify' => 'v2']);
            self::assertInstanceOf(PrequalifyService::class, $client->prequalify);
            $client->prequalify->runEnvelope(MedicalRecordLog::prequalifyInput());
            MedicalRecordLog::assertRecordAbsent($log);
        });
    }

    public function testLegacyQuoteEnvelopeDebugLogOmitsMedicalRecord(): void
    {
        $this->withLegacyWire(function (): void {
            [$client, $log] = MedicalRecordLog::loggedClient(MedicalRecordLog::V1_OK, ['quote' => 'v1']);
            self::assertInstanceOf(QuoteService::class, $client->quote);
            $client->quote->runEnvelope(MedicalRecordLog::quoteInput());
            MedicalRecordLog::assertRecordAbsent($log);
        });
    }

    public function testEchoedResponseDebugLogOmitsMedicalRecord(): void
    {
        [$client, $log] = MedicalRecordLog::loggedClient(MedicalRecordLog::echoedResponse());
        self::assertInstanceOf(QuoteV3::class, $client->quote);
        $client->quote->run(MedicalRecordLog::quoteV3Request());
        MedicalRecordLog::assertRecordAbsent($log);
    }

    public function testIsaLogDebugStderrOmitsMedicalRecordForDefaultQuote(): void
    {
        $root = dirname(__DIR__, 2);
        $command = [
            PHP_BINARY,
            '-r',
            'require ' . var_export($root . '/vendor/autoload.php', true) . ';'
            . ' require ' . var_export(__FILE__, true) . ';'
            . ' \\Isa\\Sdk\\Tests\\Zyins\\DebugRedactionDisclosureTest::emitDefaultQuoteToDebugLog();',
        ];
        $pipes = [];
        $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, $root);
        self::assertIsResource($process);
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exit = proc_close($process);
        self::assertSame(0, $exit, $stdout . $stderr);
        self::assertStringContainsString('isa-sdk request', $stderr);
        MedicalRecordLog::assertTextOmitsRecord($stderr);
    }

    public static function emitDefaultQuoteToDebugLog(): void
    {
        putenv('ISA_LOG=debug');
        $http = new MockHttpClient();
        $http->queue(200, MedicalRecordLog::V3_OK);
        $client = MedicalRecordLog::client($http, null);
        $quote = $client->quote;
        if (! $quote instanceof QuoteV3) {
            throw new \RuntimeException('default quote is not the v3 client');
        }
        $quote->run(MedicalRecordLog::quoteV3Request());
    }

    private function withLegacyWire(callable $run): void
    {
        $prior = getenv('ZYINS_LEGACY_WIRE');
        putenv('ZYINS_LEGACY_WIRE=1');
        try {
            $run();
        } finally {
            if ($prior === false) {
                putenv('ZYINS_LEGACY_WIRE');
            } else {
                putenv('ZYINS_LEGACY_WIRE=' . $prior);
            }
        }
    }
}
