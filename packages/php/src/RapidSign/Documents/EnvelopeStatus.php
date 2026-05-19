<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Documents;

/** Lifecycle state of a document on the server. */
enum EnvelopeStatus: string
{
    case Pending = 'pending';
    case Saved = 'saved';
    case Notified = 'notified';
}
