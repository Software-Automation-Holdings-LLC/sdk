<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Exception;

/**
 * License-state error (mirrors JS `LicenseError`).
 *
 * The {@see code()} return is one of: `max_activations`, `inactive`,
 * `active_elsewhere`, `locked`, `invalid_credentials`, `no_email`,
 * `unknown`. Stable across SDK releases; consumers switch on it.
 */
final class IsaLicenseException extends IsaException
{
}
