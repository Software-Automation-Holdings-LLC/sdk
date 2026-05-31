/**
 * Tier 3 quote v3 operation — `POST /v3/quote`.
 *
 * Shares the uniform `pricing[]` table and the flat `plans[]` envelope
 * with v3 prequalify (see `prequalify-v3-types.ts`). Both endpoints answer
 * one flat array; group client-side by the requested dimension with
 * {@link byAmount} (deathBenefit for face amounts, budget for monthly
 * budgets). Money is the {cents, display} amount paired with a recurrence
 * period; the v2 string-money map is gone in v3.
 */

import { fromHttpResponse } from './errors.js';
import { retryAttemptsFromHeaders } from './retryAttempts.js';
import { buildHeaders, coerceV3Offer, mintUuidV4, serializeWireBody } from './prequalify-v3.js';
import { isRecord, toBool, toStr } from './v3Coercion.js';
import type { QuoteV3Context, QuoteV3Request, QuoteV3Result, V3Offer } from './prequalify-v3-types.js';

export { byAmount } from './prequalify-v3-types.js';
export type {
  QuoteV3Context,
  QuoteV3Options,
  QuoteV3Request,
  QuoteV3Result,
  V3Offer,
} from './prequalify-v3-types.js';

const QUOTE_V3_PATH = '/v3/quote';

export async function quoteV3(request: QuoteV3Request, ctx: QuoteV3Context): Promise<QuoteV3Result> {
  const body = serializeWireBody(request);
  const idempotencyKey = ctx.idempotencyKey ?? mintUuidV4();
  const headers = await buildHeaders({
    auth: ctx.auth,
    body,
    idempotencyKey,
    clock: ctx.clock,
    path: QUOTE_V3_PATH,
  });
  const url = `${ctx.baseUrl}${QUOTE_V3_PATH}`;
  const response = await ctx.transport({ url, method: 'POST', headers, body });
  if (response.status >= 200 && response.status < 300) {
    return parseQuoteEnvelope(response.body, idempotencyKey, retryAttemptsFromHeaders(response.headers));
  }
  throw fromHttpResponse(response.status, response.body);
}

function parseQuoteEnvelope(body: string, idempotencyKey: string, retryAttempts: number): QuoteV3Result {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    throw new Error(`ZyIns quoteV3: failed to parse response body: ${(err as Error).message}`);
  }
  const root = isRecord(parsed) ? parsed : {};
  const requestId = toStr(root['request_id']);
  const echoKey = toStr(root['idempotency_key']) || idempotencyKey;
  const livemode = root['livemode'] === undefined ? true : toBool(root['livemode']);
  const data = isRecord(root['data']) ? (root['data'] as Record<string, unknown>) : {};
  // Absent plans (vs present-but-empty) indicates wire-shape drift; fail fast.
  if (!('plans' in data)) {
    throw new Error('ZyIns quoteV3: missing plans field in v3 response');
  }
  const plansRaw = Array.isArray(data['plans']) ? (data['plans'] as unknown[]) : [];
  const plans: readonly V3Offer[] = plansRaw.map(coerceV3Offer);
  return {
    plans,
    requestId,
    idempotencyKey: echoKey,
    livemode,
    retryAttempts,
  };
}
