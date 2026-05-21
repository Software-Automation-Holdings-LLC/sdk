<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Cases;

use Sah\Sdk\Zyins\Email\EnqueueInput;
use Sah\Sdk\Zyins\Email\EnqueueResult;
use Sah\Sdk\Zyins\Email\Service as EmailService;
use Sah\Sdk\Zyins\RequestOptions;
use Sah\Sdk\Zyins\Transport;

/**
 * Cases sub-service. Today exposes:
 *   - create  → POST /v1/case (content-addressed shareable artifact)
 *   - email   → POST /v1/email/enqueue (case-share convenience)
 *
 * The email helper delegates to {@see EmailService::enqueue()} so both
 * namespaces share one wire client; callers can pick whichever entry
 * point matches their mental model.
 *
 * Future list / get / delete RPCs require new server work; see the
 * design doc at docs/design/cases-email-branding-surface.md.
 */
final readonly class Service
{
    private const CREATE_PATH = '/v1/case';

    public function __construct(
        private Transport $transport,
        private EmailService $emailService,
    ) {
    }

    /**
     * Create a new shareable case from quote input + results + products.
     */
    public function create(CreateInput $input, ?RequestOptions $options = null): CreateResult
    {
        $response = $this->transport->post(self::CREATE_PATH, $input->toWireBody(), $options);
        return CreateResult::fromWire($response->data);
    }

    /**
     * Email a case-share payload — delegates to /v1/email/enqueue.
     */
    public function email(EnqueueInput $input, ?RequestOptions $options = null): EnqueueResult
    {
        return $this->emailService->enqueue($input, $options);
    }
}
