<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

/**
 * Result of {@see CasesClient::share()}: the server-assigned case id and the
 * assembled share link. The decryption key lives only in the link.
 */
final readonly class CaseShareResult
{
    public function __construct(
        /** Server-assigned case id. */
        public string $id,
        /** Full share link `{viewer}/<id>#k=<base64url(key)>`. */
        public string $link,
    ) {
    }
}
