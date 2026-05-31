<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Options;

/**
 * Per-release per-surface API version table.
 *
 * Every SDK release exports this constant so consumers can audit which
 * version of each ISA API surface this release talks to without inspecting
 * the wire. The ISA API is a federation of independently versioned
 * surfaces; there is no single global "current" version to alias.
 *
 * Resolution per call (see {@see ResolvedIsaOptions}):
 *
 *     $apiVersion[$surface] ?? BundledApiVersions::MAP[$surface]
 *
 * Mirrors:
 *  - TS  `BundledApiVersions`     (packages/ts/src/zyins/bundledApiVersions.ts)
 *  - Py  `BUNDLED_API_VERSIONS`   (packages/python/src/sah_sdk/zyins/__init__.py)
 *  - Go  `BundledAPIVersions`     (packages/go/zyins/bundled_versions.go)
 *  - C#  `BundledApiVersions.Map` (packages/csharp/src/Zyins/Options/BundledApiVersions.cs)
 *
 * See `docs/sdk-syntax-proposal.md` §2.7 for the locked decision.
 */
final class BundledApiVersions
{
    /**
     * The frozen per-surface table for this SDK release.
     *
     * @var array<string, string>
     */
    public const MAP = [
        'prequalify' => 'v2',
        'quote'      => 'v2',
        'datasets'   => 'v2',
        'reference'  => 'v2',
        'sessions'   => 'v1',
        'branding'   => 'v1',
        'cases'      => 'v1',
    ];

    /**
     * Resolve the API version for a surface, honoring per-surface overrides
     * and falling back to the bundled release default.
     *
     * @param string                $surface  Surface name (e.g. "prequalify", "quote").
     * @param array<string, string> $override Per-surface override map (typically
     *                                        {@see IsaCreateOptions::$apiVersion}).
     */
    public static function resolve(string $surface, array $override = []): string
    {
        if (isset($override[$surface]) && $override[$surface] !== '') {
            return $override[$surface];
        }
        return self::MAP[$surface] ?? '';
    }

    private function __construct()
    {
    }
}
