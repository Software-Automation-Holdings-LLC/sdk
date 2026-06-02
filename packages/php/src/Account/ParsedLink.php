<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

/**
 * A case's code and fragment key, parsed out of a share link.
 */
final readonly class ParsedLink
{
    public function __construct(
        /** The case identifier from the link's last path segment. */
        public string $code,
        /** The base64url data key from the `#k=` fragment. */
        public string $keyFragment,
    ) {
    }
}
