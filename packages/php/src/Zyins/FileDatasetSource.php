<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

use Isa\Sdk\Zyins\Reference\DatasetBundleV3;
use Isa\Sdk\Zyins\Reference\DatasetsV3;
use Throwable;

/**
 * Loads the bundle from a local file and parses it with the shared
 * {@see DatasetsV3::parseEnvelope()}. Accepts the slim
 * `reference-bundle.json` OR the full `datasets.json` — both carry the same
 * `data.datasets` shape; the reference layer reads only the reference
 * fields. The file has no ETag, so the parsed bundle's etag is `null`.
 */
final class FileDatasetSource implements DatasetSource
{
    /** @var callable(string): string */
    private $read;

    /**
     * @param callable(string): string|null $read Injectable reader; defaults
     *        to a `file_get_contents` wrapper. Injected in tests so the disk
     *        is never touched. The single filesystem call is isolated behind
     *        this facade so every other code path stays testable.
     */
    public function __construct(
        private readonly string $path,
        ?callable $read = null,
    ) {
        $this->read = $read ?? self::defaultReader(...);
    }

    public function load(): DatasetBundleV3
    {
        try {
            $body = ($this->read)($this->path);
        } catch (Throwable $e) {
            throw new DatasetSourceException(
                "FileDatasetSource: failed to read {$this->path}: {$e->getMessage()}",
                previous: $e,
            );
        }
        try {
            return DatasetsV3::parseEnvelope($body, null);
        } catch (Throwable $e) {
            throw new DatasetSourceException(
                "FileDatasetSource: failed to parse {$this->path} as a v3 dataset bundle: {$e->getMessage()}",
                previous: $e,
            );
        }
    }

    private static function defaultReader(string $path): string
    {
        $body = @file_get_contents($path);
        if ($body === false) {
            throw new DatasetSourceException("FileDatasetSource: unable to read file at {$path}");
        }
        return $body;
    }
}
