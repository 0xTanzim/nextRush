/**
 * @nextrush/dev - Consolidate Imports Codemod
 *
 * Rewrites class-model imports from deprecated shim packages to nextrush/class.
 * - @nextrush/decorators -> nextrush/class
 * - @nextrush/controllers -> nextrush/class
 * Merges, dedupes, and sorts imports. Preserves import type. Leaves @nextrush/di alone.
 *
 * @packageDocumentation
 */

interface ImportSpec {
  type: 'value' | 'type';
  name: string;
  alias?: string;
}

interface ImportGroup {
  source: string;
  specs: ImportSpec[];
}

/**
 * Parse import statements from source code.
 * Returns grouped imports by source package.
 */
function parseImports(source: string): ImportGroup[] {
  const groups: Map<string, ImportSpec[]> = new Map();

  // Match: import [type] { ... } from '...';
  // Handles multi-line, aliases, and type imports
  const importRegex =
    /import\s+(type\s+)?{\s*([^}]+)\s*}\s+from\s+['"]([^'"]+)['"]\s*;/g;

  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(source)) !== null) {
    const isType = !!match[1];
    const specStr = match[2] ?? '';
    const pkgSource = match[3] ?? '';

    if (!specStr || !pkgSource) continue;

    // Parse individual imports: name, name as alias
    const specs = specStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => {
        const parts = s.split(/\s+as\s+/);
        const name = parts[0]?.trim() ?? '';
        const alias = parts[1]?.trim();
        return { type: isType ? ('type' as const) : ('value' as const), name, alias };
      })
      .filter((spec) => spec.name.length > 0);

    const existing = groups.get(pkgSource) || [];
    groups.set(pkgSource, [...existing, ...specs]);
  }

  return Array.from(groups.entries()).map(([source, specs]) => ({ source, specs }));
}

/**
 * Merge imports from multiple sources into consolidated nextrush/class import.
 * Dedupes by (name, alias) pair, sorts by name, preserves type-only imports separately.
 */
function mergeImports(groups: ImportGroup[]): ImportGroup[] {
  const valueImports = new Map<string, ImportSpec>();
  const typeImports = new Map<string, ImportSpec>();
  let hasClassSource = false;

  // Collect from deprecated shim packages + existing nextrush/class
  for (const group of groups) {
    const source = group.source;

    // Skip @nextrush/di (stays independent)
    if (source === '@nextrush/di') {
      continue;
    }

    // Consolidate these sources into nextrush/class
    const isTargetSource =
      source === '@nextrush/decorators' ||
      source === '@nextrush/controllers' ||
      source === 'nextrush/class';

    if (isTargetSource) {
      hasClassSource = true;
      for (const spec of group.specs) {
        // Dedupe key is name+alias to preserve "X as Y" correctly
        const key = spec.alias ? `${spec.name}${spec.alias}` : spec.name;
        if (spec.type === 'type') {
          typeImports.set(key, spec);
        } else {
          valueImports.set(key, spec);
        }
      }
    }
  }

  if (!hasClassSource) {
    // No consolidation needed, return as-is
    return groups;
  }

  // Build consolidated groups
  const result: ImportGroup[] = [];

  // Add non-target imports back (like @nextrush/di)
  for (const group of groups) {
    if (
      group.source !== '@nextrush/decorators' &&
      group.source !== '@nextrush/controllers' &&
      group.source !== 'nextrush/class'
    ) {
      result.push(group);
    }
  }

  // Add consolidated value imports
  if (valueImports.size > 0) {
    const specs = Array.from(valueImports.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    result.push({ source: 'nextrush/class', specs });
  }

  // Add consolidated type imports (as separate import type statement)
  if (typeImports.size > 0 && valueImports.size === 0) {
    // Only type imports, use import type
    const specs = Array.from(typeImports.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    result.push({ source: 'nextrush/class', specs });
  } else if (typeImports.size > 0) {
    // Both value and type, type goes in separate statement
    const specs = Array.from(typeImports.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    result.push({ source: 'nextrush/class', specs });
  }

  return result;
}

/**
 * Serialize import groups back to source code.
 */
function serializeImports(groups: ImportGroup[]): string {
  return groups
    .map((group) => {
      const { source, specs } = group;
      if (specs.length === 0) return '';

      // Check if all specs are type-only
      const allTypeOnly = specs.every((s) => s.type === 'type');
      const typeKeyword = allTypeOnly ? 'type ' : '';

      // Format: import [type] { name [as alias], ... } from 'source';
      const names = specs
        .map((s) => (s.alias ? `${s.name} as ${s.alias}` : s.name))
        .join(', ');

      return `import ${typeKeyword}{ ${names} } from '${source}';`;
    })
    .filter((line) => line.length > 0)
    .join('\n');
}

/**
 * Remove import statements from source.
 */
function removeImports(source: string): string {
  const importRegex =
    /import\s+(type\s+)?{\s*[^}]+\s*}\s+from\s+['"][^'"]+['"]\s*;/g;
  return source.replace(importRegex, '').trim();
}

/**
 * Main transform function: consolidates class-model imports.
 * Pure, deterministic, idempotent.
 */
export function consolidateImports(source: string): string {
  // Parse all imports
  const groups = parseImports(source);

  // Merge/consolidate
  const merged = mergeImports(groups);

  // Serialize back
  const consolidatedImports = serializeImports(merged);

  // Remove old imports and rebuild
  const withoutImports = removeImports(source);

  // Reconstruct: imports first, then code
  if (!consolidatedImports) {
    return source; // No imports to consolidate
  }

  // If there's remaining code, add newline separator; otherwise just imports
  const remaining = withoutImports.trim();
  return remaining
    ? `${consolidatedImports}\n${remaining}`
    : consolidatedImports;
}
