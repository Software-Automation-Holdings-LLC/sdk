<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Email;

use Sah\Sdk\Zyins\RequestOptions;
use Sah\Sdk\Zyins\Transport;

/**
 * Email sub-service. Targets POST /v1/email/enqueue.
 *
 * The server validates the payload, drops it onto the email_queue
 * Postgres table, and a background worker forwards to Resend. The From
 * address is set server-side from the verified Resend domain; clients
 * cannot spoof a sender.
 *
 * Future list / get RPCs require new server work; today this is the
 * only operation.
 */
final readonly class Service
{
    private const ENQUEUE_PATH = '/v1/email/enqueue';

    public function __construct(private Transport $transport)
    {
    }

    /**
     * Enqueue a transactional email for delivery.
     */
    public function enqueue(EnqueueInput $input, ?RequestOptions $options = null): EnqueueResult
    {
        $response = $this->transport->post(self::ENQUEUE_PATH, $input->toWireBody(), $options);
        return EnqueueResult::fromWire($response->data);
    }
}
