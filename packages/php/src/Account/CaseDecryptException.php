<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

use RuntimeException;

/**
 * Raised when a case envelope fails AES-GCM authentication: a tampered,
 * corrupt, or `product`-mismatched payload, or a wrong fragment key. The
 * recipient cannot recover the plaintext; treat it as terminal.
 */
final class CaseDecryptException extends RuntimeException
{
}
