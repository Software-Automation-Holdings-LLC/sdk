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
export type EnvelopeStatus = "pending" | "saved" | "notified";
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
    /**
     * Identifies the RapidSign form the notify template should render for
     * the recipient. Omit when the signer flow is not form-driven.
     */
    readonly formId?: string;
    /**
     * Whether the notify email embeds the signer's access code directly in
     * the sign link (vs requiring it be entered separately). Defaults to
     * `false`.
     */
    readonly includeCodeInLink?: boolean;
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
/** Options for `documents.get`. */
export interface GetOpts {
    /** Optional session id forwarded as the `session_id` query parameter. */
    readonly sessionId?: string;
    /**
     * AbortSignal for caller-driven cancellation. When aborted, the call
     * rejects with `AbortError` and stops retrying immediately.
     */
    readonly signal?: AbortSignal;
}
/** Options for `documents.download`. */
export interface DownloadOpts {
    /** Optional session id forwarded as the `session_id` query parameter. */
    readonly sessionId?: string;
    /**
     * AbortSignal for caller-driven cancellation. When aborted, the call
     * rejects with `AbortError` and stops retrying immediately.
     */
    readonly signal?: AbortSignal;
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
/**
 * One step behavior in a voice script. Mirrors `api.rapidsign.v1`'s
 * voice-sign step kinds; kept open (autocomplete for known kinds, but any
 * string type-checks) so future server-side additions do not require an
 * SDK release — mirrors Go `VoiceStepKind`, a named string type that
 * accepts any value for the same reason. The `string & {}` branded-empty
 * trick keeps literal-union autocomplete without narrowing the type to a
 * closed enum (a bare `string` would drop it entirely).
 */
export type VoiceStepKind = "say" | "play" | "confirm" | "capture-name" | (string & {});
/** One carrier-configured ceremony step. Mirrors Go `VoiceStep`. */
export interface VoiceStep {
    readonly kind: VoiceStepKind;
    readonly text?: string;
    readonly audioUrl?: string;
}
/**
 * The ordered step list plus the mandatory recording-disclosure copy a
 * voice ceremony opens with. Pass a `VoiceScript` on `MintCodeRequest` to
 * publish (or republish) the script for a form; omit it to mint against
 * whatever was published earlier for the same `form`. Mirrors Go
 * `VoiceScript`.
 */
export interface VoiceScript {
    readonly disclosureText?: string;
    readonly steps: ReadonlyArray<VoiceStep>;
    readonly expectedSignerName?: string;
}
/** Inputs accepted by `voice.mintCode`. Mirrors Go `MintCodeRequest`. */
export interface MintCodeRequest {
    readonly sessionId: string;
    readonly secretKey: string;
    readonly form: string;
    readonly signer: string;
    /**
     * When supplied, publishes the voice script for `form` before minting
     * the code. Omit to mint against an already-published script.
     */
    readonly script?: VoiceScript;
}
/**
 * A freshly minted, single-use code a signer dials into the ceremony's
 * universal number with. Mirrors Go `VoiceCode`.
 */
export interface VoiceCode {
    readonly signId: string;
    readonly code: string;
    readonly expiresAt: Date;
}
//# sourceMappingURL=types.d.ts.map