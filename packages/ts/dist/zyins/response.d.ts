/** Shared response parsing helpers for ZyINS JSON endpoints. */
export declare function parseJsonResponse(body: string, operation: string): unknown;
/** Tolerate both bare response bodies and the ADR-012 `{ data: ... }` wrap. */
export declare function unwrapEnvelope(parsed: unknown): unknown;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function stringField(r: Record<string, unknown>, key: string): string;
export declare function firstStringField(r: Record<string, unknown>, keys: string[]): string;
export declare function boolField(r: Record<string, unknown>, key: string): boolean;
//# sourceMappingURL=response.d.ts.map