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

const SPECIAL_LABELS: Readonly<Record<string, string>> = {
  eapp: 'eApp',
  url: 'URL',
  pdf: 'PDF',
  faq: 'FAQ',
  api: 'API',
  id: 'ID',
};

/** Title-Case a snake_case / kebab-case plan-info key. */
export function titleCaseLabel(key: string): string {
  if (key === '') return '';
  return key
    .split(/[_-]+/)
    .filter((part) => part.length > 0)
    .map(capitalizeWord)
    .join(' ');
}

function capitalizeWord(word: string): string {
  const lower = word.toLowerCase();
  const special = SPECIAL_LABELS[lower];
  if (special !== undefined) return special;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
