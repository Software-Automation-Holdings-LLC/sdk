<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Options;

use Isa\Sdk\Zyins\Cases\CaseStorage;

/**
 * Resolved view of {@see IsaCreateOptions} with defaults applied.
 *
 * Pure value object — produced by {@see ResolvedIsaOptions::resolve()},
 * safe to pass between future factory wiring and internal client
 * construction.
 *
 * `apiVersion` carries the per-surface override map; surfaces absent
 * from the map fall back to {@see BundledApiVersions::MAP} via
 * {@see self::apiVersionFor()}.
 */
final readonly class ResolvedIsaOptions
{
    /**
     * @param array<string, string> $apiVersion per-surface override map.
     */
    public function __construct(
        public AuthSupplier $auth,
        public Engine $engine,
        public float $timeoutSeconds,
        public array $apiVersion,
        public ?string $clientVersion,
        public string $baseUrl,
        public ?string $proxyOrigin,
        public ?CaseStorage $caseStorage = null,
    ) {
    }

    /**
     * Resolve {@see IsaCreateOptions} into a fully-defaulted view.
     *
     * Pure — no side effects, safe to call from constructors and tests.
     * Mirrors the TS `resolveIsaOptions()` and Python
     * `resolve_isa_options()` semantics exactly.
     */
    public static function resolve(IsaCreateOptions $opts): self
    {
        $engine = $opts->engine ?? RemoteEngine::default();
        $proxyOrigin = $engine instanceof ProxyEngine ? $engine->proxyOrigin : null;

        return new self(
            auth: $opts->auth,
            engine: $engine,
            timeoutSeconds: $opts->timeout,
            apiVersion: $opts->apiVersion,
            clientVersion: $opts->clientVersion,
            baseUrl: $engine->baseUrl(),
            proxyOrigin: $proxyOrigin,
            caseStorage: $opts->caseStorage,
        );
    }

    /**
     * Resolve the API version for a surface — honoring this caller's
     * per-surface override and falling back to the bundled default.
     */
    public function apiVersionFor(string $surface): string
    {
        return BundledApiVersions::resolve($surface, $this->apiVersion);
    }
}
