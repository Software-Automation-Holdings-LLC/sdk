<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Cases;

use Isa\Sdk\Tests\Zyins\Support\FixedKeySource;
use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Cases\CaseRecord;
use Isa\Sdk\Zyins\Cases\CaseStorage;
use Isa\Sdk\Zyins\Cases\CaseStoragePutResult;
use Isa\Sdk\Zyins\Cases\ZeroKnowledgeCaseStorage;
use Isa\Sdk\Zyins\ZyInsClient;
use PHPUnit\Framework\TestCase;

/**
 * Pins the locked `$isa->zyins->cases->save()` / `recall()` surface and
 * the {@see CaseStorage} adapter contract.
 *
 * The default adapter ({@see ZeroKnowledgeCaseStorage}) is wired
 * automatically when the consumer does not pass `caseStorage:` to the
 * client constructor; carrier overrides plug in via the same arg.
 */
final class SaveRecallTest extends TestCase
{
    private const FIXTURE_TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';
    private const FIXED_IDEM = '550e8400-e29b-41d4-a716-446655440000';

    public function testSaveDelegatesToConfiguredCaseStorage(): void
    {
        $stub = new class implements CaseStorage {
            /** @var list<CaseRecord> */
            public array $captured = [];

            public function put(CaseRecord $record): CaseStoragePutResult
            {
                $this->captured[] = $record;
                return new CaseStoragePutResult(id: 'case_stub_1', recallToken: 'tok_stub');
            }

            public function get(string $id, ?string $recallToken = null): ?CaseRecord
            {
                return null;
            }
        };
        $client = $this->client(caseStorage: $stub);

        $result = $client->cases->save(new CaseRecord(
            product: 'zyins',
            payload: ['quote_input' => ['age' => 64]],
        ));

        self::assertCount(1, $stub->captured);
        self::assertSame('zyins', $stub->captured[0]->product);
        self::assertSame('case_stub_1', $result->id);
        self::assertSame('tok_stub', $result->recallToken);
    }

    public function testRecallDelegatesToConfiguredCaseStorage(): void
    {
        $stub = new class implements CaseStorage {
            public ?string $seenId = null;
            public ?string $seenToken = null;

            public function put(CaseRecord $record): CaseStoragePutResult
            {
                return new CaseStoragePutResult(id: 'unused');
            }

            public function get(string $id, ?string $recallToken = null): ?CaseRecord
            {
                $this->seenId = $id;
                $this->seenToken = $recallToken;
                return new CaseRecord(product: 'zyins', payload: ['echo' => $id]);
            }
        };
        $client = $this->client(caseStorage: $stub);

        $record = $client->cases->recall('case_xyz', 'tok_abc');

        self::assertSame('case_xyz', $stub->seenId);
        self::assertSame('tok_abc', $stub->seenToken);
        self::assertNotNull($record);
        self::assertSame('zyins', $record->product);
        self::assertSame(['echo' => 'case_xyz'], $record->payload);
    }

    public function testRecallReturnsNullWhenAdapterReportsMiss(): void
    {
        $stub = new class implements CaseStorage {
            public function put(CaseRecord $record): CaseStoragePutResult
            {
                return new CaseStoragePutResult(id: 'unused');
            }

            public function get(string $id, ?string $recallToken = null): ?CaseRecord
            {
                return null;
            }
        };
        $client = $this->client(caseStorage: $stub);

        self::assertNull($client->cases->recall('missing'));
    }

    public function testDefaultCaseStorageIsZeroKnowledgeWhenOmitted(): void
    {
        // No caseStorage override → save() must hit /v1/case via the
        // default ZeroKnowledgeCaseStorage adapter.
        $http = new MockHttpClient();
        $http->queue(201, json_encode([
            'data' => ['id' => 'case_zk_1'],
        ], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            httpClient: $http,
            idempotency: new FixedKeySource(self::FIXED_IDEM),
        );

        $result = $client->cases->save(new CaseRecord(
            product: 'zyins',
            payload: ['answers' => ['age' => 64]],
        ));

        self::assertSame('case_zk_1', $result->id);
        self::assertNull($result->recallToken, 'default adapter does not mint a recall token in this minor');
        self::assertCount(1, $http->requests);
        $req = $http->lastRequest();
        self::assertSame('POST', $req->getMethod());
        self::assertStringEndsWith('/v1/case', (string) $req->getUri());
    }

    public function testDefaultCaseStorageReturnsNullOn404Recall(): void
    {
        $http = new MockHttpClient();
        $http->queue(404, '');
        $client = new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            httpClient: $http,
            idempotency: new FixedKeySource(self::FIXED_IDEM),
        );

        $record = $client->cases->recall('case_missing');

        self::assertNull($record);
    }

    public function testDefaultCaseStorageDecodesRecallEnvelope(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'data' => [
                'product' => 'zyins',
                'payload' => ['answers' => ['age' => 64]],
            ],
        ], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            httpClient: $http,
            idempotency: new FixedKeySource(self::FIXED_IDEM),
        );

        $record = $client->cases->recall('case_zk_1');

        self::assertNotNull($record);
        self::assertSame('zyins', $record->product);
        self::assertSame(['answers' => ['age' => 64]], $record->payload);
    }

    public function testSaveRecallRoundTripPreservesProductAndPayload(): void
    {
        $store = new InMemoryCaseStorage();
        $client = $this->client(caseStorage: $store);

        $put = $client->cases->save(new CaseRecord(
            product: 'eapp',
            payload: ['form' => ['name' => 'John Doe']],
        ));
        $record = $client->cases->recall($put->id, $put->recallToken);

        self::assertNotNull($record);
        self::assertSame('eapp', $record->product);
        self::assertSame(['form' => ['name' => 'John Doe']], $record->payload);
    }

    public function testZeroKnowledgeCaseStorageRejectsEmptyProduct(): void
    {
        $client = $this->client();
        $this->expectException(\InvalidArgumentException::class);
        $client->cases->save(new CaseRecord(product: '', payload: ['x' => 1]));
    }

    public function testZeroKnowledgeCaseStorageRejectsEmptyRecallId(): void
    {
        $client = $this->client();
        $this->expectException(\InvalidArgumentException::class);
        $client->cases->recall('');
    }

    private function client(?CaseStorage $caseStorage = null): ZyInsClient
    {
        return new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            httpClient: new MockHttpClient(),
            idempotency: new FixedKeySource(self::FIXED_IDEM),
            caseStorage: $caseStorage,
        );
    }
}

/**
 * In-memory `CaseStorage` adapter used by the round-trip test. Mirrors
 * the locked contract: put returns id + recallToken; get echoes the
 * stored record on a hit; returns null on a miss.
 */
final class InMemoryCaseStorage implements CaseStorage
{
    /** @var array<string,CaseRecord> */
    private array $byId = [];
    private int $counter = 0;

    public function put(CaseRecord $record): CaseStoragePutResult
    {
        $id = 'case_mem_' . (++$this->counter);
        $this->byId[$id] = $record;
        return new CaseStoragePutResult(id: $id, recallToken: 'mem_tok_' . $this->counter);
    }

    public function get(string $id, ?string $recallToken = null): ?CaseRecord
    {
        return $this->byId[$id] ?? null;
    }
}
