import {
  generateClassBased,
  generateDenoJson,
  generateEnvDts,
  generateFull,
  generateFunctional,
  generateGitignore,
  generatePackageJson,
  generateReadme,
  generateTsconfig,
} from './templates/index.js';
import type { FileMap, ProjectOptions } from './types.js';

/**
 * Generates the complete file map for a new project.
 * Pure function — no I/O, fully testable.
 */
export function generateProject(options: ProjectOptions): FileMap {
  const files: FileMap = new Map();

  // Shared files that don't depend on the emitted source tree.
  files.set('tsconfig.json', generateTsconfig(options));
  files.set('package.json', generatePackageJson(options));
  files.set('src/env.d.ts', generateEnvDts(options));
  files.set('.gitignore', generateGitignore());

  // Deno projects get a Deno-native config (types, decorators, strictness) instead of
  // relying on a Node-flavored tsconfig alone.
  // capability-exempt: scaffolding tool emits runtime-specific project files from user choice,
  // not the executing runtime. `options.runtime` is a scaffold-time decision.
  if (options.runtime === 'deno') {
    files.set('deno.json', generateDenoJson(options));
  }

  // Style-specific source files
  const styleFiles = generateStyleFiles(options);
  for (const [path, content] of styleFiles) {
    files.set(path, content);
  }

  // README's "Project Structure" section is derived from the FileMap above, so it can never
  // drift from what was actually emitted (fixes F-10) — generated last, once the source tree
  // is known.
  files.set('README.md', generateReadme(options, files));

  return files;
}

function generateStyleFiles(options: ProjectOptions): FileMap {
  switch (options.style) {
    case 'functional':
      return generateFunctional(options);
    case 'class-based':
      return generateClassBased(options);
    case 'full':
      return generateFull(options);
  }
}
