<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Support;

use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Condition;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Height;
use Isa\Sdk\Zyins\Medication;
use Isa\Sdk\Zyins\NicotineUsage;
use Isa\Sdk\Zyins\Prequalify\Input as PrequalifyInput;
use Isa\Sdk\Zyins\Product;
use Isa\Sdk\Zyins\Quote\Input as QuoteInput;
use Isa\Sdk\Zyins\Reference\PrequalifyV3Request;
use Isa\Sdk\Zyins\Reference\QuoteV3Request;
use Isa\Sdk\Zyins\Sex;
use Isa\Sdk\Zyins\Weight;
use Isa\Sdk\Zyins\ZyInsClient;
use PHPUnit\Framework\Assert;
use Psr\Log\AbstractLogger;

/**
 * Applicant record and log assertions for debug-redaction tests.
 *
 * The markers are distinctive so a log line that still contains the
 * underwriting record fails, and a redacted or omitted body passes.
 */
final class MedicalRecordLog
{
    public const TOKEN = 'isa_test_EXAMPLE';
    public const DOB = '1954-07-23';
    public const SEX = 'female';
    public const STATE = 'VT';
    public const ZIP = '05602';
    public const HEIGHT = 73;
    public const WEIGHT = 241;
    public const CONDITION = 'AorticStenosisMarker';
    public const DIAGNOSED = 'DiagnosedNineYearsMarker';
    public const TREATED = 'TreatedTwoMonthsMarker';
    public const MEDICATION = 'MetoprololMarker';
    public const USE = 'HeartFailureMarker';
    public const FIRST_FILL = 'FilledElevenMonthsMarker';
    public const LAST_FILL = 'FilledThreeMonthsMarker';
    public const V3_OK = '{"object":"list","request_id":"req_redaction","livemode":false,"data":{"plans":[]}}';
    public const V1_OK = '{"object":"list","request_id":"req_redaction","data":{"plans":[],"product_token":"prod_marker","tier":"standard","monthly_premium":12,"face_value":25000}}';

    /**
     * @param array<string, string> $apiVersions
     * @return array{0: ZyInsClient, 1: CapturingLogger}
     */
    public static function loggedClient(string $responseBody, array $apiVersions = []): array
    {
        $http = new MockHttpClient();
        $http->queue(200, $responseBody);
        $log = new CapturingLogger();
        return [self::client($http, $log, $apiVersions), $log];
    }

    /**
     * @param array<string, string> $apiVersions
     */
    public static function client(MockHttpClient $http, ?CapturingLogger $log, array $apiVersions = []): ZyInsClient
    {
        return new ZyInsClient(
            token: self::TOKEN,
            httpClient: $http,
            idempotency: new FixedKeySource('550e8400-e29b-41d4-a716-446655440000'),
            logger: $log,
            apiVersionMap: $apiVersions,
        );
    }

    public static function assertRecordAbsent(CapturingLogger $log): void
    {
        $requestLogged = false;
        foreach ($log->records as $record) {
            if ($record['message'] === 'isa-sdk request') {
                $requestLogged = true;
            }
        }
        Assert::assertTrue($requestLogged, 'debug logging produced no request record');
        self::assertTextOmitsRecord(json_encode($log->records, JSON_THROW_ON_ERROR));
    }

    public static function assertTextOmitsRecord(string $text): void
    {
        foreach ([
            self::DOB, self::SEX, self::STATE, self::ZIP, self::CONDITION, self::DIAGNOSED,
            self::TREATED, self::MEDICATION, self::USE, self::FIRST_FILL, self::LAST_FILL,
        ] as $needle) {
            Assert::assertStringNotContainsString($needle, $text);
        }
        Assert::assertDoesNotMatchRegularExpression('/\b' . self::HEIGHT . '\b/', $text);
        Assert::assertDoesNotMatchRegularExpression('/\b' . self::WEIGHT . '\b/', $text);
    }

    public static function applicant(): Applicant
    {
        return new Applicant(
            dob: self::DOB,
            sex: Sex::Female,
            height: Height::fromInches(self::HEIGHT),
            weight: Weight::fromPounds(self::WEIGHT),
            state: self::STATE,
            nicotineUse: NicotineUsage::None,
            zip: self::ZIP,
            medications: [new Medication(self::MEDICATION, self::USE, self::FIRST_FILL, self::LAST_FILL)],
            conditions: [new Condition(self::CONDITION, self::DIAGNOSED, self::TREATED)],
        );
    }

    public static function prequalifyInput(): PrequalifyInput
    {
        return new PrequalifyInput(self::applicant(), Coverage::faceValue(25000), [self::product()]);
    }

    public static function quoteInput(): QuoteInput
    {
        return new QuoteInput(self::applicant(), Coverage::faceValue(25000), self::product());
    }

    public static function prequalifyV3Request(): PrequalifyV3Request
    {
        return new PrequalifyV3Request(self::applicant(), Coverage::faceValue(25000), [self::product()]);
    }

    public static function quoteV3Request(): QuoteV3Request
    {
        return new QuoteV3Request(self::applicant(), Coverage::faceValue(25000), [self::product()]);
    }

    public static function echoedResponse(): string
    {
        return json_encode([
            'object' => 'quote_result',
            'request_id' => 'req_redaction',
            'livemode' => false,
            'data' => ['plans' => []],
            'date_of_birth' => self::DOB,
            'gender' => self::SEX,
            'height' => self::HEIGHT,
            'weight' => self::WEIGHT,
            'state' => self::STATE,
            'zip' => self::ZIP,
            'conditions' => [[
                'name' => self::CONDITION,
                'wasDiagnosed' => self::DIAGNOSED,
                'lastTreatment' => self::TREATED,
            ]],
            'medications' => [[
                'name' => self::MEDICATION,
                'use' => self::USE,
                'firstFill' => self::FIRST_FILL,
                'lastFill' => self::LAST_FILL,
            ]],
        ], JSON_THROW_ON_ERROR);
    }

    private static function product(): Product
    {
        return new Product(id: 'prod_marker', name: 'Marker Product', class: 'term', carrier: 'Marker Carrier');
    }
}

/**
 * PSR-3 sink that keeps every debug record the transport emits.
 */
final class CapturingLogger extends AbstractLogger
{
    /** @var array<int, array{level: mixed, message: string, context: array<string, mixed>}> */
    public array $records = [];

    /**
     * @param mixed $level
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
