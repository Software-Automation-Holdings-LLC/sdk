<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

use Isa\Sdk\Zyins\Reference\DatasetBundleV3;
use Throwable;

/**
 * Tries each source in order; the first that resolves wins. The documented
 * chain is local file -> optional generate hook -> API fallback: pass the
 * generate hook as `$onMissing` and it runs once, after the first source
 * fails and before the next is tried. When every source fails, {@see load()}
 * throws a {@see DatasetSourceException} naming each attempt.
 */
final class ResolvingDatasetSource implements DatasetSource
{
    /** @var list<DatasetSource> */
    private readonly array $sources;

    /** @var callable(): void|null */
    private $onMissing;

    /**
     * @param list<DatasetSource> $sources
     * @param callable(): void|null $onMissing
     */
    public function __construct(array $sources, ?callable $onMissing = null)
    {
        if ($sources === []) {
            throw new DatasetSourceException(
                'ResolvingDatasetSource: at least one source is required',
            );
        }
        $this->sources = array_values($sources);
        $this->onMissing = $onMissing;
    }

    public function load(): DatasetBundleV3
    {
        $failures = [];
        foreach ($this->sources as $index => $source) {
            try {
                return $source->load();
            } catch (Throwable $e) {
                $failures[] = sprintf('%s failed (%s)', $source::class, $e->getMessage());
            }
            if ($index === 0 && $this->onMissing !== null) {
                $this->runOnMissing($failures);
            }
        }
        throw new DatasetSourceException(
            'ResolvingDatasetSource: every source failed — ' . implode('; ', $failures),
        );
    }

    /** @param list<string> $failures */
    private function runOnMissing(array &$failures): void
    {
        $hook = $this->onMissing;
        if ($hook === null) {
            return;
        }
        try {
            $hook();
        } catch (Throwable $e) {
            $failures[] = sprintf('onMissing hook failed (%s)', $e->getMessage());
        }
    }
}
