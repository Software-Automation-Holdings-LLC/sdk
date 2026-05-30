/**
 * Title Case label derivation for plan-info keys.
 *
 * The post-zyins#349 wire shape carries a server-emitted `label` per item
 * — used verbatim. For pre-#349 bodies (legacy `Record<string, string[]>`)
 * the SDK upconverts to the typed array surface and synthesizes a label
 * by Title-Casing the snake_case key so downstream UIs see one type only.
 *
 * Special-cases the well-known `eapp` token to `eApp` to match the
 * server's canonical capitalization. All other tokens follow the generic
 * "split on `_` / `-`, capitalize each word" rule.
 */
/** Title-Case a snake_case / kebab-case plan-info key. */
export declare function titleCaseLabel(key: string): string;
//# sourceMappingURL=planInfoLabel.d.ts.map