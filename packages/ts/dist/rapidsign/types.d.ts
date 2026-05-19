/**
 * Public value types for the Tier 3 RapidSign facade.
 *
 * Cross-language naming spec: these names (Envelope, Signature, Recipient,
 * PdfSource, SendRequest, CancelRequest, AwaitOpts) are the ground truth the
 * parallel Go and PHP agents mirror with their language casing.
 *
 * Timestamps are exposed as `Date`; never as raw ISO strings. The wire is the
 * boundary the SDK absorbs.
 */
/** Lifecycle state of a document on the server. */
export type EnvelopeStatus = 'pending' | 'saved' | 'notified';
/** Recipient (a single signer; v1 is one-signer-per-doc). */
export interface Recipient {
    readonly email: string;
    readonly name?: string;
}
/** One PDF source the server fetches and merges into the packet. */
export interface PdfSource {
    /** Fully-qualified URL the server fetches server-side. */
    readonly url: string;
    /** Optional hex-encoded SHA-256 the server validates the fetch against. */
    readonly expectedHash?: string;
}
/** Inputs accepted by `documents.send`. */
export interface SendRequest {
    /** Ordered PDF sources merged into the packet. */
    readonly packet: ReadonlyArray<PdfSource>;
    /** Signer email + optional display name. */
    readonly recipient: Recipient;
    /** Optional binding legal text embedded beneath the signature block. */
    readonly legalText?: string;
    /** Caller-defined metadata stored verbatim (≤ 64 keys, scalar values). */
    readonly metadata?: Record<string, string>;
    /**
     * ISO-8601 duration (e.g. `P30D`) or milliseconds. When omitted, the
     * server applies its default TTL.
     */
    readonly expiresIn?: string | number;
    /**
     * Optional template/notification key (selects which template the emailer
     * renders). Omit for the default signer template.
     */
    readonly notificationKey?: string;
    /**
     * Optional caller-supplied idempotency key. Defaults to an auto-generated
     * UUIDv4 per call; supplying one is reserved for advanced cases.
     */
    readonly idempotencyKey?: string;
}
/** The packet that came back from `documents.send` / `documents.get`. */
export interface Envelope {
    /** Document id (server-minted). Prefixed `doc_` in production. */
    readonly id: string;
    /** Signer id used to address every per-signer operation. */
    readonly signId: string;
    /** Signer-facing URL the recipient opens to sign. */
    readonly signUrl: string;
    /** Read-only URL the sender uses to monitor the packet. */
    readonly viewUrl: string;
    /** Lifecycle state. */
    readonly status: EnvelopeStatus;
    /** Recipient as supplied at send time (echoed for audit). */
    readonly recipient: Recipient;
    /** Source URL → SHA-256 hex actually embedded. Always populated. */
    readonly hashes: Record<string, string>;
    /** When the document was created on the server. */
    readonly createdAt: Date;
    /** When the document will be purged from the server (TTL boundary). */
    readonly expiresAt: Date;
    /** Caller metadata as supplied at send time, echoed. */
    readonly metadata: Record<string, string>;
}
/** The signature that came back from `awaitSignature` / `get` after signing. */
export interface Signature {
    readonly signId: string;
    /** Decoded signature image bytes. */
    readonly signature: Buffer;
    readonly signedAt: Date;
    /** IP address of the signer captured at signing time. */
    readonly signerIp: string;
    readonly userAgent: string;
    /** Free-form audit metadata stored at signing time. */
    readonly metadata: Record<string, string>;
}
/** Cancellation inputs (server endpoint not yet implemented; see issue #38). */
export interface CancelRequest {
    /** Operator-facing reason recorded with the cancel event. */
    readonly reason: string;
}
/** Options for `awaitSignature` polling. */
export interface AwaitOpts {
    /**
     * Maximum time to wait. ISO-8601 duration (e.g. `PT24H`, `PT5M`), a plain
     * number (milliseconds), or a shorthand string `2s`/`5m`/`24h`/`7d`.
     *
     * The default is 24 hours.
     */
    readonly timeout?: string | number;
    /**
     * AbortSignal for caller-driven cancellation. When aborted, the call
     * rejects with `AbortError` and stops polling immediately.
     */
    readonly signal?: AbortSignal;
}
//# sourceMappingURL=types.d.ts.map