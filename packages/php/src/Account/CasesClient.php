<?php

declare(strict_types=1);

namespace Sah\Sdk\Account;

use InvalidArgumentException;

/**
 * `$isa->account->cases` — shareable case create / get / list / email.
 *
 * Wire shapes mirror `shared/schemas/api/account/v1/cases.proto`:
 *   - POST /v1/cases/create
 *   - POST /v1/cases/get
 *   - POST /v1/cases/list
 *   - POST /v1/cases/email   (strict `{case_id, to}` — NOT a generic
 *                              email transport — that lives on
 *                              {@see EmailClient::enqueue()})
 */
final readonly class CasesClient
{
    public function __construct(private Http $http)
    {
    }

    /**
     * Persist a case and return its short hash + shareable URL.
     *
     * @param mixed $input   Raw XML string OR JSON-encodable object representing the proposed insured. Required.
     * @param mixed $results Optional engine evaluation results. Presence freezes the case read-only.
     * @param array<int,string>|null $products Optional product-filter slugs.
     * @return BaseResponse
     */
    public function create(mixed $input, mixed $results = null, ?array $products = null): BaseResponse
    {
        if ($input === null) {
            throw new InvalidArgumentException('account.cases: create requires input');
        }
        $payload = ['input' => $input];
        if ($results !== null) {
            $payload['results'] = $results;
        }
        if ($products !== null) {
            $payload['products'] = $products;
        }
        /** @var BaseResponse $env */
        $env = $this->http->postEnvelope('/v1/cases/create', $payload);
        return $this->withCaseDetail($env);
    }

    /**
     * Fetch a case body by its short hash.
     *
     * @return BaseResponse
     */
    public function get(string $caseId): BaseResponse
    {
        if (trim($caseId) === '') {
            throw new InvalidArgumentException('account.cases: get requires caseId');
        }
        /** @var BaseResponse $env */
        $env = $this->http->postEnvelope('/v1/cases/get', ['case_id' => $caseId]);
        return $this->withCaseDetail($env);
    }

    /**
     * List cases owned by the authenticated account.
     *
     * @param string|null $cursor Cursor (server-issued short hash); omit on first page.
     * @param int|null    $limit  Page size; server clamps to its maximum.
     */
    public function list(?string $cursor = null, ?int $limit = null): CasesListEnvelope
    {
        $payload = [];
        if ($cursor !== null) {
            $payload['starting_after'] = $cursor;
        }
        if ($limit !== null) {
            if ($limit <= 0) {
                throw new InvalidArgumentException('account.cases: list requires limit > 0');
            }
            $payload['limit'] = $limit;
        }
        $raw = $this->http->postRawEnvelope('/v1/cases/list', $payload);
        $rawData = $raw['data'] ?? [];
        /** @var CaseDetail[] $data */
        $data = [];
        if (is_array($rawData)) {
            foreach ($rawData as $item) {
                $data[] = CaseDetail::fromWire($item);
            }
        }
        return new CasesListEnvelope(
            object: is_string($raw['object'] ?? null) ? (string) $raw['object'] : 'list',
            livemode: is_bool($raw['livemode'] ?? null) ? (bool) $raw['livemode'] : true,
            requestId: is_string($raw['request_id'] ?? null) ? (string) $raw['request_id'] : '',
            idempotencyKey: is_string($raw['idempotency_key'] ?? null) ? (string) $raw['idempotency_key'] : '',
            data: $data,
            hasMore: is_bool($raw['has_more'] ?? null) ? (bool) $raw['has_more'] : false,
        );
    }

    /**
     * Email the shareable case URL to a recipient (Open > Load Case).
     *
     * @return BaseResponse
     */
    public function email(string $caseId, string $to): BaseResponse
    {
        if (trim($caseId) === '') {
            throw new InvalidArgumentException('account.cases: email requires caseId');
        }
        if (trim($to) === '') {
            throw new InvalidArgumentException('account.cases: email requires to');
        }
        /** @var BaseResponse $env */
        $env = $this->http->postEnvelope('/v1/cases/email', ['case_id' => $caseId, 'to' => $to]);
        return new BaseResponse(
            object: $env->object,
            livemode: $env->livemode,
            requestId: $env->requestId,
            idempotencyKey: $env->idempotencyKey,
            data: EmailCaseAck::fromWire($env->data),
        );
    }

    /**
     * @param BaseResponse $env
     * @return BaseResponse
     */
    private function withCaseDetail(BaseResponse $env): BaseResponse
    {
        return new BaseResponse(
            object: $env->object,
            livemode: $env->livemode,
            requestId: $env->requestId,
            idempotencyKey: $env->idempotencyKey,
            data: CaseDetail::fromWire($env->data),
        );
    }
}
