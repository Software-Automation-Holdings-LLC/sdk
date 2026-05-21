<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Cases;

use InvalidArgumentException;

/**
 * Typed request for {@see Service::create()}.
 *
 * The input field is polymorphic on the wire: a structured array is
 * converted to XML server-side; a string is treated as raw XML.
 */
final readonly class CreateInput
{
    /**
     * @param array<string,mixed>|string $input    Quote input — structured or raw XML.
     * @param mixed                      $results  Optional quote results (any JSON-serializable).
     * @param list<string>               $products Optional list of product identifiers.
     */
    public function __construct(
        public array|string $input,
        public mixed $results = null,
        public array $products = [],
    ) {
        if (is_string($input) && trim($input) === '') {
            throw new InvalidArgumentException('Cases\\CreateInput: input must be non-empty');
        }
        if (is_array($input) && $input === []) {
            throw new InvalidArgumentException('Cases\\CreateInput: input must be non-empty');
        }
    }

    /**
     * @return array<string,mixed>
     */
    public function toWireBody(): array
    {
        $body = ['input' => $this->input];
        if ($this->results !== null) {
            $body['results'] = $this->results;
        }
        if ($this->products !== []) {
            $body['products'] = $this->products;
        }
        return $body;
    }
}
