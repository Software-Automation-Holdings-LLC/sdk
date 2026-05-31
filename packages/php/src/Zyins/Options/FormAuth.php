<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Options;

use InvalidArgumentException;

/**
 * Form-token auth supplier (embedded eApp).
 */
final readonly class FormAuth implements AuthSupplier
{
    public function __construct(public string $formToken)
    {
    }

    public function kind(): string
    {
        return 'form';
    }

    public static function fromToken(string $formToken): self
    {
        if ($formToken === '') {
            throw new InvalidArgumentException(
                'FormAuth::fromToken: formToken must be a non-empty string'
            );
        }

        return new self($formToken);
    }
}
