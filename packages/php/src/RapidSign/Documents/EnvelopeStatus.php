<?php

declare(strict_types=1);

namespace Isa\Sdk\RapidSign\Documents;

/** Lifecycle state of a document on the server. */
enum EnvelopeStatus: string
{
    case Pending = 'pending';
    case Saved = 'saved';
    case Notified = 'notified';
}
