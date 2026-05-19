/**
 * Response envelope (SDK_DESIGN.md §4.6).
 *
 * Every successful method call returns an `Envelope<T>` whose typed named
 * fields surface the correlation, idempotency, and retry metadata that the
 * server returned. This is the type contract the SDK consumer holds.
 *
 * Field naming follows the TypeScript idiom (camelCase). Wire form is
 * snake_case; the conversion happens at the parse boundary so call sites
 * never see snake_case spelling.
 */
export {};
//# sourceMappingURL=envelope.js.map