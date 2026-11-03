<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

use Isa\Sdk\Zyins\Reference\DatasetBundleV3;

/**
 * Loads the bundle from a caller-supplied fetcher — the current
 * `datasetsV3->get()` HTTP path. Uses the already-configured client
 * credential; it introduces no new service key.
 */
final class ApiDatasetSource implements DatasetSource
{
    /** @var callable(): DatasetBundleV3 */
    private $fetch;

    /** @param callable(): DatasetBundleV3 $fetch */
    public function __construct(callable $fetch)
    {
        $this->fetch = $fetch;
    }

    public function load(): DatasetBundleV3
    {
        return ($this->fetch)();
    }
}
