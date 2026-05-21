<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Email;

use InvalidArgumentException;

/**
 * Typed request for {@see Service::enqueue()} and {@see Cases\Service::email()}.
 *
 * The attachment is supplied as raw bytes; the SDK base64-encodes it
 * before placing it on the wire.
 */
final readonly class EnqueueInput
{
    public function __construct(
        public string $to,
        public string $subject,
        public string $bodyHtml,
        public string $attachmentFilename = '',
        public string $attachmentContent = '',
    ) {
        if (trim($to) === '') {
            throw new InvalidArgumentException('Email\\EnqueueInput: to is required');
        }
    }

    /**
     * @return array<string,mixed>
     */
    public function toWireBody(): array
    {
        $body = [
            'to' => $this->to,
            'subject' => $this->subject,
            'body_html' => $this->bodyHtml,
        ];
        if ($this->attachmentFilename !== '' || $this->attachmentContent !== '') {
            $body['attachment'] = [
                'filename' => $this->attachmentFilename,
                'content_base64' => base64_encode($this->attachmentContent),
            ];
        }
        return $body;
    }
}
