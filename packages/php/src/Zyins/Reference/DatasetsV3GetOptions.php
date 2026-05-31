<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

use InvalidArgumentException;

/**
 * Options accepted by `DatasetsV3::get()`. Builder-style so call sites
 * stay declarative.
 *
 *  - `include` narrows the response to specific categories. `null`
 *    omits the parameter entirely (default); a non-null array — even
 *    the empty array — emits an `include=` parameter on the wire.
 *    Per the server contract, an empty `include=` is the documented
 *    "meta-only shortcut" (versions + counts, no row payload).
 *  - `fields` switches between `full` (default, returns rows) and
 *    `meta` (versions + counts only).
 *  - `ifNoneMatch` opts the call into conditional revalidation: the
 *    server returns `304` and an empty body when the ETag still
 *    matches; the SDK surfaces that as {@see DatasetsV3NotModified}.
 */
final readonly class DatasetsV3GetOptions
{
    /** Wire token for the `full` fields mode. */
    public const FIELDS_FULL = 'full';
    /** Wire token for the `meta` fields mode (no `items[]`). */
    public const FIELDS_META = 'meta';

    /**
     * @param list<DatasetCategory>|null $include `null` omits the parameter; an
     *        array (even empty) emits it on the wire.
     */
    private function __construct(
        public ?array $include = null,
        public ?string $fields = null,
        public ?string $ifNoneMatch = null,
    ) {
        if ($this->fields !== null && $this->fields !== self::FIELDS_FULL && $this->fields !== self::FIELDS_META) {
            throw new InvalidArgumentException(
                'DatasetsV3GetOptions.fields must be "full" or "meta"',
            );
        }
    }

    public static function default(): self
    {
        return new self();
    }

    /**
     * Pass an array of categories to narrow the response. Passing the
     * empty array (`withInclude([])`) explicitly opts into the server's
     * "meta-only shortcut" — the param is sent with an empty value.
     *
     * @param list<DatasetCategory> $categories
     * @throws InvalidArgumentException when an element is not a DatasetCategory.
     */
    public function withInclude(array $categories): self
    {
        foreach ($categories as $i => $category) {
            if (! $category instanceof DatasetCategory) {
                throw new InvalidArgumentException(sprintf(
                    'DatasetsV3GetOptions::withInclude expects DatasetCategory enum values; ' .
                    'element at index %d is not a DatasetCategory.',
                    $i,
                ));
            }
        }
        return new self(include: $categories, fields: $this->fields, ifNoneMatch: $this->ifNoneMatch);
    }

    public function withFieldsMeta(): self
    {
        return new self(include: $this->include, fields: self::FIELDS_META, ifNoneMatch: $this->ifNoneMatch);
    }

    public function withFieldsFull(): self
    {
        return new self(include: $this->include, fields: self::FIELDS_FULL, ifNoneMatch: $this->ifNoneMatch);
    }

    public function withIfNoneMatch(string $etag): self
    {
        return new self(include: $this->include, fields: $this->fields, ifNoneMatch: $etag);
    }
}
