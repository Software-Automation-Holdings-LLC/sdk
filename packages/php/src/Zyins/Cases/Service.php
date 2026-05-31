<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Cases;

use Isa\Sdk\Zyins\Email\EnqueueInput;
use Isa\Sdk\Zyins\Email\EnqueueResult;
use Isa\Sdk\Zyins\Email\Service as EmailService;
use Isa\Sdk\Zyins\RequestOptions;
use Isa\Sdk\Zyins\Transport;

/**
 * Cases sub-service. Surfaces:
 *
 *   - save    → `CaseStorage->put()`  (canonical, adapter-routed)
 *   - recall  → `CaseStorage->get()`  (canonical, adapter-routed)
 *   - share   → `POST /v1/case`       (legacy shareable artifact)
 *   - create  → alias of `share`      (deprecated)
 *   - email   → `POST /v1/email/enqueue` (case-share convenience)
 *
 * The `save` / `recall` pair is the locked SDK surface per the syntax
 * proposal (TS canon: `isa.zyins.cases.save / recall`). Both delegate
 * to the configured {@see CaseStorage} adapter — by default
 * {@see ZeroKnowledgeCaseStorage}; carrier overrides plug in via
 * {@see \Isa\Sdk\Zyins\ZyInsClient}'s `caseStorage` constructor arg.
 *
 * The email helper delegates to {@see EmailService::enqueue()} so both
 * namespaces share one wire client; callers can pick whichever entry
 * point matches their mental model.
 */
final readonly class Service
{
    private const CREATE_PATH = '/v1/case';

    public function __construct(
        private Transport $transport,
        private EmailService $emailService,
        private CaseStorage $caseStorage,
    ) {
    }

    /**
     * Persist a case via the configured {@see CaseStorage} adapter.
     *
     * Canonical save verb per the locked SDK syntax (TS canon:
     * `isa.zyins.cases.save`). Returns the adapter-assigned id and an
     * optional opaque `recallToken` the consumer threads back into
     * {@see recall()}.
     */
    public function save(CaseRecord $record): CaseStoragePutResult
    {
        return $this->caseStorage->put($record);
    }

    /**
     * Resolve a previously-saved case via the configured
     * {@see CaseStorage} adapter. Returns `null` when the record is
     * absent (expired, deleted, or never existed — adapters do not
     * distinguish these by design).
     *
     * Canonical recall verb per the locked SDK syntax (TS canon:
     * `isa.zyins.cases.recall`).
     */
    public function recall(string $id, ?string $recallToken = null): ?CaseRecord
    {
        return $this->caseStorage->get($id, $recallToken);
    }

    /**
     * Create a new shareable case from quote input + results + products.
     *
     * @deprecated Use {@see self::share()} — the canonical verb per the
     * locked SDK syntax (TS canon: `isa.zyins.cases.share`). This alias
     * is retained for one minor and will be removed in v0.7.0.
     */
    public function create(CreateInput $input, ?RequestOptions $options = null): CreateResult
    {
        $response = $this->transport->post(self::CREATE_PATH, $input->toWireBody(), $options);
        return CreateResult::fromWire($response->data);
    }

    /**
     * Create (share) a shareable case. Canonical verb per the locked
     * SDK syntax (TS canon: `isa.zyins.cases.share`); equivalent to
     * {@see self::create()}, which is retained as a deprecated alias.
     */
    public function share(CreateInput $input, ?RequestOptions $options = null): CreateResult
    {
        return $this->create($input, $options);
    }

    /**
     * Email a case-share payload — delegates to /v1/email/enqueue.
     */
    public function email(EnqueueInput $input, ?RequestOptions $options = null): EnqueueResult
    {
        return $this->emailService->enqueue($input, $options);
    }
}
