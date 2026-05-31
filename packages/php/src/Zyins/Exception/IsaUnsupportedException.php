<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Exception;

use Throwable;

/**
 * Thrown when a caller invokes an operation that the active adapter
 * does not implement — for example, `cases.delete()` against a
 * carrier-controlled case store whose retention policy bars SDK-side
 * deletion.
 *
 * Mirrors the TS `IsaUnsupportedError`. Callers switch on
 * {@see IsaException::code()} which returns `unsupported_operation`.
 */
final class IsaUnsupportedException extends IsaException
{
    public const CODE = 'unsupported_operation';

    public function __construct(
        string $message,
        ?Throwable $previous = null,
    ) {
        parent::__construct(
            message: $message,
            errorCode: self::CODE,
            previous: $previous,
        );
    }
}
