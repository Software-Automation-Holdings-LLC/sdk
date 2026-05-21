/** Shared response parsing helpers for ZyINS JSON endpoints. */

export function parseJsonResponse(body: string, operation: string): unknown {
  try {
    return JSON.parse(body);
  } catch (err) {
    throw new Error(`zyins: ${operation} response was not valid JSON: ${(err as Error).message}`);
  }
}

/** Tolerate both bare response bodies and the ADR-012 `{ data: ... }` wrap. */
export function unwrapEnvelope(parsed: unknown): unknown {
  if (
    isRecord(parsed) &&
    'data' in parsed &&
    parsed.data !== null &&
    parsed.data !== undefined
  ) {
    return parsed.data;
  }
  return parsed;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stringField(r: Record<string, unknown>, key: string): string {
  const v = r[key];
  return typeof v === 'string' ? v : '';
}

export function firstStringField(r: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return '';
}

export function boolField(r: Record<string, unknown>, key: string): boolean {
  const v = r[key];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return false;
}
