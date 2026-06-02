<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

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
    public function __construct(
        private Http $http,
        private string $caseViewerBaseUrl = CaseLink::DEFAULT_VIEWER_BASE_URL,
        private CaseCrypto $caseCrypto = new CaseCrypto(),
    ) {
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
     * Encrypt a payload client-side, store the opaque envelope via
     * `POST /v1/case`, and return the fragment-keyed share link. The
     * decryption key never reaches the server. The returned link is a value
     * and nothing else — never logged, never attached to a thrown error.
     *
     * @param mixed $payload Arbitrary JSON payload, encrypted before it leaves the SDK.
     */
    public function share(string $product, mixed $payload): CaseShareResult
    {
        if (trim($product) === '') {
            throw new InvalidArgumentException('account.cases: share requires a product');
        }
        if ($payload === null) {
            throw new InvalidArgumentException('account.cases: share requires a payload');
        }
        $encrypted = $this->caseCrypto->encrypt($product, $payload);
        $raw = $this->http->postRawEnvelope('/v1/case', [
            'product' => $product,
            'ciphertext' => $encrypted->envelope->ciphertext,
            'iv' => $encrypted->envelope->iv,
            'tag' => $encrypted->envelope->tag,
        ]);
        $data = is_array($raw['data'] ?? null) ? $raw['data'] : $raw;
        $id = is_string($data['id'] ?? null) ? (string) $data['id'] : '';
        if ($id === '') {
            throw new InvalidArgumentException('account.cases: share response missing id');
        }
        return new CaseShareResult(
            id: $id,
            link: CaseLink::assemble($this->caseViewerBaseUrl, $id, $encrypted->keyFragment),
        );
    }

    /**
     * Resolve a share link: parse the code + fragment key, fetch the opaque
     * envelope via `GET /v1/case/{code}`, and decrypt locally. The key comes
     * only from the link the caller already holds.
     */
    public function open(string $link): CaseOpenResult
    {
        $parsed = CaseLink::parse($link);
        $path = '/v1/case/' . rawurlencode($parsed->code);
        $data = $this->http->getRawEnvelope($path);
        $product = is_string($data['product'] ?? null) ? (string) $data['product'] : '';
        if ($product === '') {
            throw new InvalidArgumentException('account.cases: open response missing product');
        }
        $envelope = new CaseEnvelope(
            ciphertext: is_string($data['ciphertext'] ?? null) ? (string) $data['ciphertext'] : '',
            iv: is_string($data['iv'] ?? null) ? (string) $data['iv'] : '',
            tag: is_string($data['tag'] ?? null) ? (string) $data['tag'] : '',
        );
        $payload = $this->caseCrypto->decrypt($product, $envelope, $parsed->keyFragment);
        return new CaseOpenResult(product: $product, payload: $payload);
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
