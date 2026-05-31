/**
 * RapidSign client — the public entrypoint.
 *
 * Construction:
 *
 *   import { RapidSignClient } from '@isa-sdk/rapidsign';
 *   const rapidsign = new RapidSignClient('isa_live_…');
 *   await rapidsign.documents.send({ … });
 *
 * The parent `ISA` umbrella client (in a separate package) wires this in
 * as `isa.rapidsign`. The umbrella's existence is intentionally not
 * mandatory: a curator only using RapidSign can construct this class
 * directly and skip the umbrella entirely.
 */
import { DocumentsService } from './documents.js';
import { RapidSignError } from './errors.js';
import { WebhooksService } from './webhooks.js';
import { defaultTransport } from './internal/transport.js';
import { defaultDecompressor } from './internal/decompress.js';
import { defaultSleeper, defaultUUIDGenerator, systemClock, } from './internal/random.js';
/** Production RapidSign endpoint. Override only for staging / local. */
export const DEFAULT_RAPIDSIGN_BASE_URL = 'https://rapidsign.isaapi.com';
/** Default User-Agent string. The version is updated on each release. */
export const DEFAULT_USER_AGENT = '@isa-sdk/rapidsign-js/0.0.0';
/** Default retry budget for transient 5xx / 429 errors. */
export const DEFAULT_MAX_RETRIES = 2;
/**
 * The RapidSign client. Construct once per bearer token; methods are
 * grouped under typed sub-clients (`documents`, `webhooks`).
 */
export class RapidSignClient {
    documents;
    webhooks;
    constructor(token, options = {}) {
        const trimmedToken = typeof token === 'string' ? token.trim() : '';
        if (trimmedToken.length === 0) {
            throw new RapidSignError.ValidationError('RapidSignClient: bearer token is required', {
                httpStatus: 400,
                requestId: '',
                param: 'token',
            });
        }
        const ctx = {
            token: trimmedToken,
            baseUrl: options.baseUrl ?? DEFAULT_RAPIDSIGN_BASE_URL,
            userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
            transport: options.transport ?? defaultTransport(options.fetch),
            clock: options.clock ?? systemClock,
            sleeper: options.sleeper ?? defaultSleeper,
            uuid: options.uuid ?? defaultUUIDGenerator,
            decompressor: options.decompressor ?? defaultDecompressor,
            maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
        };
        this.documents = new DocumentsService(ctx);
        this.webhooks = new WebhooksService();
    }
}
//# sourceMappingURL=client.js.map