<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * The `isa->zyins->reference` namespace contract.
 *
 *  - `medications()` returns the medication-typed matcher.
 *  - `conditions()` returns the condition-typed matcher.
 *  - `concepts()` returns the kind-agnostic matcher.
 *
 * `MakeKey` is internal — never exposed. Pair the matchers with a
 * {@see DatasetBundleV3} from `DatasetsV3::get()` to resolve free text.
 */
interface ReferenceService
{
    public function medications(): Matcher;

    public function conditions(): Matcher;

    public function concepts(): Matcher;
}
