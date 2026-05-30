/**
 * Tier 3 quote v3 operation — `POST /v3/quote`.
 *
 * Shares the uniform `pricing[]` table shape with v3 prequalify (see
 * `prequalify-v3-types.ts`). The quote endpoint groups qualifying
 * products by requested amount for side-by-side comparison tables.
 * Money is integer cents + display string; the v2 string-money map is
 * gone in v3.
 */

import { fromHttpResponse } from './errors';
import { retryAttemptsFromHeaders } from './retryAttempts';
import {
  buildHeaders,
  coercePricingRow,
  mintUuidV4,
  serializeWireBody,
} from './prequalify-v3';
import {
  coerceCarrier,
  coerceMoney,
  coerceProduct,
  isRecord,
  toBool,
  toStr,
} from './v3Coercion';
import type {
  QuoteV3Context,
  QuoteV3Group,
  QuoteV3Product,
  QuoteV3Request,
  QuoteV3Result,
} from './prequalify-v3-types';

export type {
  QuoteV3Context,
  QuoteV3Group,
  QuoteV3Options,
  QuoteV3Product,
  QuoteV3Request,
  QuoteV3Result,
} from './prequalify-v3-types';

const QUOTE_V3_PATH = '/v3/quote';

export async function quoteV3(
  request: QuoteV3Request,
  ctx: QuoteV3Context,
): Promise<QuoteV3Result> {
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
    return parseQuoteEnvelope(
      response.body,
      idempotencyKey,
      retryAttemptsFromHeaders(response.headers),
    );
  }
  throw fromHttpResponse(response.status, response.body);
}

function parseQuoteEnvelope(
  body: string,
  idempotencyKey: string,
  retryAttempts: number,
): QuoteV3Result {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    throw new Error(
      `ZyIns quoteV3: failed to parse response body: ${(err as Error).message}`,
    );
  }
  const root = isRecord(parsed) ? parsed : {};
  const requestId = toStr(root['request_id']);
  const echoKey = toStr(root['idempotency_key']) || idempotencyKey;
  const livemode = root['livemode'] === undefined ? true : toBool(root['livemode']);
  const data = isRecord(root['data']) ? (root['data'] as Record<string, unknown>) : {};
  const groupsRaw = Array.isArray(data['results']) ? (data['results'] as unknown[]) : [];
  const results = groupsRaw.map(coerceGroup);
  return {
    results,
    requestId,
    idempotencyKey: echoKey,
    livemode,
    retryAttempts,
  };
}

function coerceQuoteProduct(raw: unknown): QuoteV3Product {
  const r = isRecord(raw) ? raw : {};
  const pricingRaw = Array.isArray(r['pricing']) ? (r['pricing'] as unknown[]) : [];
  return {
    object: 'plan_offer',
    id: toStr(r['id']),
    eligible: toBool(r['eligible']),
    carrier: coerceCarrier(r['carrier']),
    product: coerceProduct(r['product']),
    deathBenefit: coerceMoney(r['death_benefit']),
    pricing: pricingRaw.map(coercePricingRow),
  };
}

function coerceGroup(raw: unknown): QuoteV3Group {
  const r = isRecord(raw) ? raw : {};
  const productsRaw = Array.isArray(r['products']) ? (r['products'] as unknown[]) : [];
  return {
    amount: toStr(r['amount']),
    products: productsRaw.map(coerceQuoteProduct),
  };
}
