import {
  generateClassBased,
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

  // Shared files
  const needsDecorators = options.style === 'class-based' || options.style === 'full';
  files.set('tsconfig.json', generateTsconfig(needsDecorators));
  files.set('package.json', generatePackageJson(options));
  files.set('README.md', generateReadme(options));
  files.set('src/env.d.ts', generateEnvDts());
  files.set('.gitignore', generateGitignore());

  // Style-specific source files
  const styleFiles = generateStyleFiles(options);
  for (const [path, content] of styleFiles) {
    files.set(path, content);
  }

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
