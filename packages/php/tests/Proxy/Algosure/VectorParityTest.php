<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Proxy\Algosure;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\Proxy\Algosure\AlgosureInput;
use Sah\Sdk\Proxy\Algosure\AlgosureSigner;
use Sah\Sdk\Tests\Proxy\Support\FixedClock;

/**
 * Cross-language parity gate.
 *
 * Replays every vector in
 * `shared/schemas/sdk/testdata/algosure_vectors.json` and asserts byte
 * equality against the canonical expected outputs. JS and Go run the
 * same vectors; this test keeps the PHP port locked to them.
 */
#[CoversClass(AlgosureSigner::class)]
final class VectorParityTest extends TestCase
{
    public function testEveryVectorMatchesCanonicalExpectedOutputs(): void
    {
        $raw = file_get_contents(__DIR__ . '/../testdata/algosure_vectors.json');
        $this->assertNotFalse($raw, 'vectors file missing');
        /** @var array<string,mixed> $bundle */
        $bundle = json_decode($raw, associative: true, flags: JSON_THROW_ON_ERROR);
        $this->assertIsArray($bundle['vectors']);

        foreach ($bundle['vectors'] as $vector) {
            $this->assertIsArray($vector);
            // The verifier-only vectors exercise signature failure paths that
            // belong to the server-side verifier; the signer test asserts
            // only on "pass"-side derivations.
            if (($vector['verifier'] ?? '') !== 'pass') {
                continue;
            }
            $inputs = $vector['inputs'];
            $expected = $vector['expected'];
            $this->assertIsArray($inputs);
            $this->assertIsArray($expected);

            $clock = new FixedClock((int) $inputs['timestamp_ms']);
            $signer = new AlgosureSigner(clock: $clock);

            $body = $inputs['body'] ?? null;
            $this->assertTrue($body === null || is_string($body) || is_array($body));

            $input = new AlgosureInput(
                host: (string) $inputs['host'],
                method: (string) $inputs['method'],
                path: (string) $inputs['path'],
                salt: (string) $inputs['salt_content'],
                saltId: is_int($inputs['salt_id']) ? $inputs['salt_id'] : (string) $inputs['salt_id'],
                sessionId: (string) $inputs['session_id'],
                body: $body,
            );

            $derivedKey = AlgosureSigner::deriveSimpleKey($input->salt, $input->timestampMs ?? $clock->nowMillis());
            $this->assertSame(
                (string) $expected['simple_key_hex'],
                bin2hex($derivedKey),
                'simple key mismatch on vector ' . (string) ($vector['name'] ?? '?'),
            );

            [$tag, $ts] = $signer->computeHmac($input);
            $this->assertSame((int) $inputs['timestamp_ms'], $ts);
            $this->assertSame(
                (string) $expected['authorization_hex'],
                $tag,
                'authorization mismatch on vector ' . (string) ($vector['name'] ?? '?'),
            );

            $headers = $signer->buildHeaders($input);
            $expectedHeaders = $expected['headers'];
            $this->assertIsArray($expectedHeaders);
            foreach ($expectedHeaders as $name => $value) {
                $this->assertIsString($name);
                $this->assertIsString($value);
                $this->assertSame($value, $headers[$name] ?? null, "header $name mismatch");
            }
        }
    }
}
