<?php

declare(strict_types=1);

namespace Isa\Sdk\Catalog;

/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Source data:
 *   - isa-platform/shared/go/events/registry.go
 *
 * RapidSign webhook event types. The wire string is the EventBridge
 * `detail-type` value the platform emits.
 */
enum SignEvent: string
{
    case DocumentSigned = 'document.signed';
}
