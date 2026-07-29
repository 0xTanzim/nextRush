import { createFileSystemGeneratorCache, createGenerator } from 'fumadocs-typescript';

/**
 * Shared TypeScript-doc generator for `<auto-type-table>` / `<AutoTypeTable>`.
 *
 * Extracts type shapes directly from source files under `packages/*\/src` at
 * build time, so reference tables render real exported types instead of
 * hand-maintained copies that can drift from the code.
 *
 * A single instance is shared between the remark plugin (`source.config.ts`,
 * which compiles `<auto-type-table>` markdown syntax) and the React
 * `AutoTypeTable` component (`mdx-components.tsx`, used directly in `.mdx`)
 * so both paths hit the same on-disk generation cache.
 */
export const typeTableGenerator = createGenerator({
  cache: createFileSystemGeneratorCache('.source/type-table-cache.json'),
});
