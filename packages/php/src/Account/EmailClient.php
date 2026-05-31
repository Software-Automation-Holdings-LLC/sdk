<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

use InvalidArgumentException;

/**
 * `$isa->account->email` — transactional email enqueue.
 *
 *   - POST /v1/email/enqueue
 *
 * Wire shape mirrors `shared/schemas/api/zyins/v1/email.proto` (no
 * `account/v1/email.proto` exists yet — the endpoint lives under the
 * account API surface per CONTRACT C12 but the proto remains in the
 * zyins package until the migration completes).
 *
 * The server returns a bare `{object, status}` body today; the SDK
 * funnels it through the BaseResponse parser so callers see a stable
 * shape once the endpoint is elevated.
 */
final readonly class EmailClient
{
    public function __construct(private Http $http)
    {
    }

    /**
     * Enqueue a transactional email.
     *
     * @param array{
     *   to:string,
     *   subject:string,
     *   body:string,
     *   template?:string,
     *   templateData?:mixed,
     *   replyTo?:string,
     *   attachments?:array<int,EmailAttachment>
     * } $request
     * @return BaseResponse
     */
    public function enqueue(array $request): BaseResponse
    {
        $to = $request['to'] ?? null;
        $subject = $request['subject'] ?? null;
        $body = $request['body'] ?? null;
        if (! is_string($to) || trim($to) === '') {
            throw new InvalidArgumentException('account.email: enqueue requires to');
        }
        if (! is_string($subject) || trim($subject) === '') {
            throw new InvalidArgumentException('account.email: enqueue requires subject');
        }
        if (! is_string($body) || trim($body) === '') {
            throw new InvalidArgumentException('account.email: enqueue requires body');
        }

        $payload = ['to' => $to, 'subject' => $subject, 'body' => $body];
        if (isset($request['template'])) {
            $payload['template'] = $request['template'];
        }
        if (array_key_exists('templateData', $request)) {
            $payload['template_data'] = $request['templateData'];
        }
        if (isset($request['replyTo'])) {
            $payload['reply_to'] = $request['replyTo'];
        }
        if (isset($request['attachments'])) {
            /** @var array<int,EmailAttachment> $atts */
            $atts = $request['attachments'];
            $payload['attachments'] = array_map(static fn (EmailAttachment $a) => $a->toWire(), $atts);
        }

        /** @var BaseResponse $env */
        $env = $this->http->postEnvelope('/v1/email/enqueue', $payload, allowMissingData: true);
        return new BaseResponse(
            object: $env->object,
            livemode: $env->livemode,
            requestId: $env->requestId,
            idempotencyKey: $env->idempotencyKey,
            data: EnqueueEmailAck::fromWire($env->data, $env->object),
        );
    }
}
