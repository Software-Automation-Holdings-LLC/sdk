<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

use Isa\Sdk\Zyins\Reference\DatasetBundleV3;

/**
 * Pluggable source for the v3 reference bundle.
 *
 * The reference layer (`conditions->match` / `medications->match` /
 * autocomplete / fuzzy / autocorrect) is warmed by default from a live
 * `datasetsV3->get()` HTTP call. A DatasetSource lets the same layer load
 * from a local artifact — offline, inside the engine, or anywhere a network
 * round-trip is undesirable. The contract is a single `load(): DatasetBundleV3`;
 * how the bytes arrive is the source's business.
 *
 * Three implementations ship: {@see FileDatasetSource} (read a file, parse
 * with the EXISTING {@see Reference\DatasetsV3::parseEnvelope()} — no second
 * parser), {@see ApiDatasetSource} (the current HTTP path), and
 * {@see ResolvingDatasetSource} (try sources in order, first success wins:
 * local file -> optional generate hook -> API). Default behavior is
 * unchanged: with no source the SDK uses the API path exactly as before.
 */
interface DatasetSource
{
    /**
     * Resolve the bundle. Throws {@see DatasetSourceException} naming the
     * source and the failing input when the bundle cannot be produced.
     */
    public function load(): DatasetBundleV3;
}
