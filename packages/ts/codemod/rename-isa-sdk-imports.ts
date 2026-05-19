/**
 * jscodeshift transform: rewrite per-product imports to the unified
 * `@software-automation-holdings-llc/sdk` package.
 *
 * Status: scaffold. Wire to `npx jscodeshift -t codemod/rename-isa-sdk-imports.ts <path>`
 * when the codemod harness lands (tracked alongside the v0.3.0 release).
 */
import type { API, FileInfo, Options } from 'jscodeshift';

const OLD = [
  '@isa-sdk/core',
  '@isa-sdk/zyins',
  '@isa-sdk/rapidsign',
  '@isa-sdk/proxy',
];
const NEW_PKG = '@software-automation-holdings-llc/sdk';

export default function transform(file: FileInfo, api: API, _opts: Options): string {
  const j = api.jscodeshift;
  const root = j(file.source);
  root
    .find(j.ImportDeclaration)
    .filter((p) => OLD.includes(String(p.node.source.value)))
    .forEach((p) => {
      p.node.source = j.literal(NEW_PKG);
    });
  return root.toSource({ quote: 'single' });
}
