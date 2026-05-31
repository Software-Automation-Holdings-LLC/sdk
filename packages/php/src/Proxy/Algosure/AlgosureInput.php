<?php

declare(strict_types=1);

namespace Isa\Sdk\Proxy\Algosure;

/**
 * Inputs for an Algosure HMAC tag.
 *
 * Mirrors `EmbeddedAlgosureArgs` (JS) and the Go signer's parameter
 * set. The `salt` + `saltId` pair is what makes this the embedded-salt
 * variant: the publishing pipeline stamps both into form metadata at
 * save time, the runtime passes both as arguments, and no runtime salt
 * fetch occurs.
 */
final readonly class AlgosureInput
{
    /**
     * @param string         $host        The `*Host` value (customer-scoped form host).
     * @param string         $method      HTTP method (e.g. POST).
     * @param string         $path        Request path (e.g. /v1/call).
     * @param string         $salt        Embedded platform salt content.
     * @param int|string     $saltId      Embedded salt rotation id.
     * @param string         $sessionId   Session identifier (`*sessionId`).
     * @param mixed $body Request body — string passes through; other values are JSON-encoded.
     * @param int|null       $timestampMs Explicit timestamp in ms; overrides the clock.
     */
    public function __construct(
        public string $host,
        public string $method,
        public string $path,
        public string $salt,
        public int|string $saltId,
        public string $sessionId,
        public mixed $body = null,
        public ?int $timestampMs = null,
    ) {
    }
}
