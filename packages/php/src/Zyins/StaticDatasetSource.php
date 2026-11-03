<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

use Isa\Sdk\Zyins\Reference\DatasetBundleV3;

/** Serves a bundle already in memory. */
final class StaticDatasetSource implements DatasetSource
{
    public function __construct(private readonly DatasetBundleV3 $bundle)
    {
    }

    public function load(): DatasetBundleV3
    {
        return $this->bundle;
    }
}
