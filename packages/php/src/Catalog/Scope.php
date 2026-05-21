<?php

declare(strict_types=1);

namespace Sah\Sdk\Catalog;

/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Source data:
 *   - isa-platform/shared/schemas/api/isa/v1/common.proto
 *
 * Bearer-token scopes recognized across the ISA platform. Mirrors the
 * `api.isa.v1.Scope` proto enum's wire-form values; new scopes ship
 * here when added upstream.
 */
enum Scope: string
{
    /** Send signer notification emails. */
    case RapidsignDocumentsNotify = 'rapidsign:documents:notify';
    /** Fetch signature state and signed PDFs. */
    case RapidsignDocumentsRead = 'rapidsign:documents:read';
    /** Submit signatures. */
    case RapidsignDocumentsSign = 'rapidsign:documents:sign';
    /** Create new documents. */
    case RapidsignDocumentsWrite = 'rapidsign:documents:write';
}
