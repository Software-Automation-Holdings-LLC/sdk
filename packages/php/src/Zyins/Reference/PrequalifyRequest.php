<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * De-versioned canonical name for {@see PrequalifyV3Request}.
 *
 * The public SDK call site is unversioned — `$isa->zyins->prequalify`
 * routes to whichever /vN the bundled version table selects — so the
 * request type it accepts carries no version suffix. A thin subclass (not
 * a runtime class_alias) so static analysis resolves it and it is accepted
 * everywhere a PrequalifyV3Request is expected; the parent's promoted
 * constructor is inherited, so `new PrequalifyRequest(...)` takes the
 * identical named arguments. See api/guides/api-version-pinning.md.
 */
readonly class PrequalifyRequest extends PrequalifyV3Request
{
}
