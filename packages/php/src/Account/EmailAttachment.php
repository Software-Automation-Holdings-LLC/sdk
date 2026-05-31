<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

/**
 * Attachment carried with a transactional email. Filename plus base64-
 * encoded body; decoded payload MUST be ≤ 10 MiB to clear the server.
 */
final readonly class EmailAttachment
{
    public function __construct(
        public string $filename,
        public string $content,
    ) {
    }

    /**
     * @return array{filename:string,content:string}
     */
    public function toWire(): array
    {
        return ['filename' => $this->filename, 'content' => $this->content];
    }
}
