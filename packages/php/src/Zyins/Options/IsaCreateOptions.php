<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Options;

use InvalidArgumentException;
use Isa\Sdk\Zyins\Cases\CaseStorage;

/**
 * Typed options-bag for future high-level SDK creation.
 *
 * Mirrors the TS `IsaCreateOptions` and Python `IsaCreateOptions`
 * shapes. Every field is optional except `auth`; defaults match the
 * production posture (RemoteEngine::default(), 30s timeout, bundled
 * per-surface API versions from {@see BundledApiVersions::MAP}).
 *
 *     $opts = new IsaCreateOptions(
 *         auth:       BearerAuth::fromToken('isa_live_...'),
 *         engine:     RemoteEngine::default(),
 *         timeout:    30.0,
 *         apiVersion: ['quote' => 'v2'],
 *     );
 *
 * See `docs/sdk-syntax-proposal.md` §2.7 — `apiVersion` is per-surface;
 * there is no shorthand string form and no `default` key.
 */
final readonly class IsaCreateOptions
{
    /** Default per-call timeout in seconds (matches the TS 30_000 ms). */
    public const DEFAULT_TIMEOUT_SECONDS = 30.0;

    /**
     * Per-surface API version override map.
     *
     * Keys are surface names (e.g. `"prequalify"`, `"quote"`,
     * `"datasets"`, `"reference"`, `"sessions"`, `"branding"`,
     * `"cases"`). Values are the version string for that surface
     * (e.g. `"v1"`, `"v2"`). Surfaces absent from this map fall back to
     * {@see BundledApiVersions::MAP}.
     *
     * @param AuthSupplier          $auth         required.
     * @param Engine|null           $engine       default: RemoteEngine::default().
     * @param float                 $timeout      default: DEFAULT_TIMEOUT_SECONDS.
     * @param array<string, string>      $apiVersion    per-surface overrides; defaults to bundled.
     * @param string|null                $clientVersion optional consumer build identifier.
     * @param CaseStorage|null           $caseStorage   pluggable case store; the factory
     *                                                  instantiates {@see \Isa\Sdk\Zyins\Cases\ZeroKnowledgeCaseStorage}
     *                                                  when null so the built-in store is
     *                                                  not a special case.
     */
    public function __construct(
        public AuthSupplier $auth,
        public ?Engine $engine = null,
        public float $timeout = self::DEFAULT_TIMEOUT_SECONDS,
        public array $apiVersion = [],
        public ?string $clientVersion = null,
        public ?CaseStorage $caseStorage = null,
    ) {
        self::validateApiVersion($apiVersion);
    }

    /**
     * Resolve the API version for a specific surface, honoring the
     * per-surface override map and falling back to the bundled default.
     */
    public function resolveApiVersion(string $surface): string
    {
        return BundledApiVersions::resolve($surface, $this->apiVersion);
    }

    /**
     * @param array<string, string> $apiVersion
     */
    private static function validateApiVersion(array $apiVersion): void
    {
        foreach ($apiVersion as $surface => $version) {
            if ($surface === '' || $surface === 'default') {
                throw new InvalidArgumentException(sprintf(
                    'IsaCreateOptions: apiVersion key must be a non-empty surface name (got %s); '
                    . 'there is no "default" key — list each surface explicitly',
                    var_export($surface, true),
                ));
            }
            if ($version === '' || preg_match('/^v\d+$/', $version) !== 1) {
                throw new InvalidArgumentException(sprintf(
                    'IsaCreateOptions: apiVersion[%s] must match /^v\\d+$/ (got %s)',
                    $surface,
                    var_export($version, true),
                ));
            }
        }
    }
}
