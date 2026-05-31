<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Result of a `GET /v3/datasets` that the server answered with `304 Not
 * Modified` — the caller's `If-None-Match` etag still matches the
 * server's current catalog version. Callers reuse their cached
 * {@see DatasetBundleV3} and stay on the cheap path.
 *
 * `DatasetsV3::get()` returns either this class or a {@see DatasetBundleV3};
 * use {@see DatasetsV3NotModified::is()} to discriminate.
 */
final readonly class DatasetsV3NotModified
{
    public function __construct(public ?string $etag) {}

    /**
     * Discriminator helper:
     *
     *     $result = $isa->zyins->datasetsV3->get($opts);
     *     if (DatasetsV3NotModified::is($result)) {
     *         useCachedBundle();
     *     } else {
     *         useFreshBundle($result);
     *     }
     */
    public static function is(DatasetBundleV3|self $result): bool
    {
        return $result instanceof self;
    }
}
