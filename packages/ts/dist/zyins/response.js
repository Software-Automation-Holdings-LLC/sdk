/** Shared response parsing helpers for ZyINS JSON endpoints. */
export function parseJsonResponse(body, operation) {
    try {
        return JSON.parse(body);
    }
    catch (err) {
        throw new Error(`zyins: ${operation} response was not valid JSON: ${err.message}`);
    }
}
/** Tolerate both bare response bodies and the ADR-012 `{ data: ... }` wrap. */
export function unwrapEnvelope(parsed) {
    if (isRecord(parsed) &&
        'data' in parsed &&
        parsed.data !== null &&
        parsed.data !== undefined) {
        return parsed.data;
    }
    return parsed;
}
export function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function stringField(r, key) {
    const v = r[key];
    return typeof v === 'string' ? v : '';
}
export function firstStringField(r, keys) {
    for (const k of keys) {
        const v = r[k];
        if (typeof v === 'string' && v.length > 0)
            return v;
    }
    return '';
}
export function boolField(r, key) {
    const v = r[key];
    if (typeof v === 'boolean')
        return v;
    if (typeof v === 'string')
        return v === 'true' || v === '1';
    return false;
}
//# sourceMappingURL=response.js.map