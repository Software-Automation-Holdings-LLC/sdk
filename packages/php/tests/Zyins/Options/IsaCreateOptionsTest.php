<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Options;

use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\Zyins\Options\BearerAuth;
use Isa\Sdk\Zyins\Options\BundledApiVersions;
use Isa\Sdk\Zyins\Options\FormAuth;
use Isa\Sdk\Zyins\Options\InMemoryEngine;
use Isa\Sdk\Zyins\Options\IsaCreateOptions;
use Isa\Sdk\Zyins\Options\LicenseAuth;
use Isa\Sdk\Zyins\Options\LocalEngine;
use Isa\Sdk\Zyins\Options\ProxyEngine;
use Isa\Sdk\Zyins\Options\RemoteEngine;
use Isa\Sdk\Zyins\Options\ResolvedIsaOptions;
use Isa\Sdk\Zyins\Options\SessionAuth;

/**
 * Tests for the typed options-bag constructor + auth-supplier /
 * engine-selector primitives. Mirrors
 * packages/python/tests/zyins/test_isa_options.py and the TS
 * isaOptions.test.ts coverage.
 */
final class IsaCreateOptionsTest extends TestCase
{
    /** Synthetic, non-credential placeholder for shape checks. */
    private const FAKE_TEST_TOKEN = 'isa_test_' . 'FAKEPLACEHOLDER';

    public function testBearerAuthFromTokenWithExplicitValue(): void
    {
        $supplier = BearerAuth::fromToken(self::FAKE_TEST_TOKEN);
        self::assertSame('bearer', $supplier->kind());
        self::assertSame(self::FAKE_TEST_TOKEN, $supplier->token);
    }

    public function testBearerAuthFromTokenRejectsEmpty(): void
    {
        $this->expectException(InvalidArgumentException::class);
        BearerAuth::fromToken('');
    }

    public function testBearerAuthFromEnvCarriesNoToken(): void
    {
        $supplier = BearerAuth::fromEnv();
        self::assertNull($supplier->token);
    }

    public function testLicenseAuthFromKeycode(): void
    {
        $supplier = LicenseAuth::fromKeycode('ABC-123-XYZ', 'agent@example.com');
        self::assertSame('license', $supplier->kind());
        self::assertSame('ABC-123-XYZ', $supplier->keycode);
        self::assertSame('agent@example.com', $supplier->email);
    }

    public function testLicenseAuthRejectsEmptyKeycode(): void
    {
        $this->expectException(InvalidArgumentException::class);
        LicenseAuth::fromKeycode('', 'agent@example.com');
    }

    public function testLicenseAuthRejectsEmptyEmail(): void
    {
        $this->expectException(InvalidArgumentException::class);
        LicenseAuth::fromKeycode('ABC-123-XYZ', '');
    }

    public function testLicenseAuthFromEnvCarriesNoCredentials(): void
    {
        $supplier = LicenseAuth::fromEnv();
        self::assertNull($supplier->keycode);
        self::assertNull($supplier->email);
    }

    public function testFormAuthFromToken(): void
    {
        $supplier = FormAuth::fromToken('form_abc123');
        self::assertSame('form', $supplier->kind());
        self::assertSame('form_abc123', $supplier->formToken);
    }

    public function testFormAuthRejectsEmpty(): void
    {
        $this->expectException(InvalidArgumentException::class);
        FormAuth::fromToken('');
    }

    public function testSessionAuthKind(): void
    {
        $supplier = new SessionAuth('sess_id', 'sess_secret');
        self::assertSame('session', $supplier->kind());
    }

    public function testSessionAuthRejectsEmptySessionId(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new SessionAuth('', 'sess_secret');
    }

    public function testSessionAuthRejectsEmptySessionSecret(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new SessionAuth('sess_id', '');
    }

    public function testRemoteEngineDefault(): void
    {
        $engine = RemoteEngine::default();
        self::assertSame('remote', $engine->kind());
        self::assertSame(RemoteEngine::PRODUCTION_ORIGIN, $engine->baseUrl());
    }

    public function testRemoteEngineAt(): void
    {
        $engine = RemoteEngine::at('https://staging.example.com');
        self::assertSame('https://staging.example.com', $engine->baseUrl());
    }

    public function testRemoteEngineAtRejectsEmpty(): void
    {
        $this->expectException(InvalidArgumentException::class);
        RemoteEngine::at('');
    }

    public function testLocalEngineAt(): void
    {
        $engine = LocalEngine::at('http://localhost:9090');
        self::assertSame('local', $engine->kind());
        self::assertSame('http://localhost:9090', $engine->baseUrl());
    }

    public function testProxyEngineDefault(): void
    {
        $engine = ProxyEngine::default();
        self::assertSame('proxy', $engine->kind());
        self::assertSame(RemoteEngine::PRODUCTION_ORIGIN, $engine->baseUrl());
        self::assertSame(ProxyEngine::PRODUCTION_ORIGIN, $engine->proxyOrigin);
    }

    public function testInMemoryEngineKind(): void
    {
        $engine = new InMemoryEngine();
        self::assertSame('in_memory', $engine->kind());
    }

    public function testIsaCreateOptionsDefaults(): void
    {
        $opts = new IsaCreateOptions(auth: BearerAuth::fromToken(self::FAKE_TEST_TOKEN));
        self::assertSame(IsaCreateOptions::DEFAULT_TIMEOUT_SECONDS, $opts->timeout);
        self::assertSame([], $opts->apiVersion);
        self::assertNull($opts->engine);
    }

    public function testIsaCreateOptionsRejectsDefaultKey(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new IsaCreateOptions(
            auth: BearerAuth::fromToken(self::FAKE_TEST_TOKEN),
            apiVersion: ['default' => 'v2'],
        );
    }

    public function testIsaCreateOptionsRejectsMalformedVersion(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new IsaCreateOptions(
            auth: BearerAuth::fromToken(self::FAKE_TEST_TOKEN),
            apiVersion: ['quote' => '2'],
        );
    }

    public function testResolveIsaOptionsAppliesDefaults(): void
    {
        $resolved = ResolvedIsaOptions::resolve(new IsaCreateOptions(
            auth: BearerAuth::fromToken(self::FAKE_TEST_TOKEN),
        ));
        self::assertSame(IsaCreateOptions::DEFAULT_TIMEOUT_SECONDS, $resolved->timeoutSeconds);
        self::assertSame([], $resolved->apiVersion);
        self::assertSame(RemoteEngine::PRODUCTION_ORIGIN, $resolved->baseUrl);
        self::assertNull($resolved->proxyOrigin);
        self::assertInstanceOf(RemoteEngine::class, $resolved->engine);
    }

    public function testResolveIsaOptionsLocalEngineSetsBaseUrl(): void
    {
        $resolved = ResolvedIsaOptions::resolve(new IsaCreateOptions(
            auth: BearerAuth::fromToken(self::FAKE_TEST_TOKEN),
            engine: LocalEngine::at('http://localhost:9090'),
        ));
        self::assertSame('http://localhost:9090', $resolved->baseUrl);
    }

    public function testResolveIsaOptionsProxyEngineCarriesOrigin(): void
    {
        $resolved = ResolvedIsaOptions::resolve(new IsaCreateOptions(
            auth: BearerAuth::fromToken(self::FAKE_TEST_TOKEN),
            engine: ProxyEngine::at('https://proxy.example.com'),
        ));
        // Proxy mode targets the production origin for the underlying
        // ZyINS request; proxyOrigin lives on the resolved options for
        // the proxy namespace to consume.
        self::assertSame(RemoteEngine::PRODUCTION_ORIGIN, $resolved->baseUrl);
        self::assertSame('https://proxy.example.com', $resolved->proxyOrigin);
    }

    public function testResolveIsaOptionsExplicitTimeout(): void
    {
        $resolved = ResolvedIsaOptions::resolve(new IsaCreateOptions(
            auth: BearerAuth::fromToken(self::FAKE_TEST_TOKEN),
            timeout: 5.0,
        ));
        self::assertSame(5.0, $resolved->timeoutSeconds);
    }

    public function testApiVersionPerSurfaceOverride(): void
    {
        // Per-surface override: quote pinned to v2, prequalify falls back to bundled.
        $resolved = ResolvedIsaOptions::resolve(new IsaCreateOptions(
            auth: BearerAuth::fromToken(self::FAKE_TEST_TOKEN),
            apiVersion: ['quote' => 'v2'],
        ));
        self::assertSame('v2', $resolved->apiVersionFor('quote'));
        self::assertSame(
            BundledApiVersions::MAP['prequalify'],
            $resolved->apiVersionFor('prequalify'),
        );
    }

    public function testBundledApiVersionsMapShape(): void
    {
        // Pin the locked release table — v3 freeze plan, §2.7.
        self::assertSame('v2', BundledApiVersions::MAP['prequalify']);
        self::assertSame('v2', BundledApiVersions::MAP['quote']);
        self::assertSame('v2', BundledApiVersions::MAP['datasets']);
        self::assertSame('v2', BundledApiVersions::MAP['reference']);
        self::assertSame('v1', BundledApiVersions::MAP['sessions']);
        self::assertSame('v1', BundledApiVersions::MAP['branding']);
        self::assertSame('v1', BundledApiVersions::MAP['cases']);
    }

    public function testBundledApiVersionsResolveFallsBackToBundled(): void
    {
        self::assertSame('v2', BundledApiVersions::resolve('quote'));
        self::assertSame('v2', BundledApiVersions::resolve('quote', []));
    }

    public function testBundledApiVersionsResolveHonorsOverride(): void
    {
        self::assertSame('v3', BundledApiVersions::resolve('quote', ['quote' => 'v3']));
        // Override on an unrelated surface does not affect this surface.
        self::assertSame('v2', BundledApiVersions::resolve('quote', ['datasets' => 'v3']));
    }
}
