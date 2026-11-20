<?php

declare(strict_types=1);

namespace Isa\Sdk\Core;

use InvalidArgumentException;

/**
 * Places caller-supplied values into request paths.
 *
 * A value spliced into a path must address exactly one segment, as seen by
 * every hop that reads it: the client, any gateway in front of the API, and
 * the server. Percent-encoding alone does not guarantee that. `.` and `..`
 * pass through `rawurlencode` unchanged and are removed as dot segments, and
 * a gateway that decodes once turns an encoded `/` back into a separator.
 * Either way the request, and the credentials attached to it, lands on
 * another route.
 */
final class PathSegment
{
    /**
     * Bytes some hop may treat as a segment boundary once decoded: the path
     * separator, the backslash some servers fold into it, and the percent
     * sign that would hide either from a single decode.
     */
    private const SEPARATORS = '/\\%';

    private function __construct()
    {
    }

    /**
     * Return `$value` percent-encoded as exactly one URL path segment.
     *
     * @throws InvalidArgumentException for the empty string, `.` and `..`,
     *     and any value containing `/`, `\`, or `%`.
     */
    public static function encode(string $value): string
    {
        if ($value === '' || $value === '.' || $value === '..' || strpbrk($value, self::SEPARATORS) !== false) {
            throw new InvalidArgumentException(sprintf('%s is not a single path segment', var_export($value, true)));
        }
        return rawurlencode($value);
    }
}
