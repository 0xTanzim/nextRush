import {
  generateClassBased,
  generateDenoJson,
  generateEnvDts,
  generateEnvFiles,
  generateExampleFiles,
  generateFull,
  generateFunctional,
  generateGitignore,
  generatePackageJson,
  generatePresetFiles,
  generateReadme,
  generateTsconfig,
  generateYarnrc,
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

  // Environment files (`.env` + `.env.example` for EVERY runtime — the layout is
  // runtime-agnostic); the generated app owns `.env` loading.
  for (const envFile of generateEnvFiles()) {
    files.set(envFile.path, envFile.content);
  }

  // Yarn Berry (v4) defaults to PnP, which would leave a generated project without a
  // materialized `node_modules` — pin `nodeLinker: node-modules` so its scripts
  // (nextrush dev/build, vitest) work out of the box like every other manager.
  if (options.packageManager === 'yarn') {
    files.set('.yarnrc.yml', generateYarnrc());
  }

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

  // Opt-in production-service preset (design decision 6) — additive; the base starter
  // file map is unchanged when the preset is not selected.
  for (const [path, content] of generatePresetFiles(options)) {
    files.set(path, content);
  }

  // Governed task-oriented examples compose through the same template path.
  for (const [path, content] of generateExampleFiles(options)) {
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
