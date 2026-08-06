import { resolve } from 'node:path';

import { generateProject } from './generator.js';
import type { FileMap, ProjectOptions } from './types.js';

/** A fully resolved scaffold, computed before any target, Git, or install side effect. */
export interface ScaffoldPlan {
  readonly options: ProjectOptions;
  readonly targetDir: string;
  readonly files: FileMap;
  readonly verificationUrl: string;
}

/** Creates the deterministic file plan consumed by both dry-run and execution. */
export function resolveScaffoldPlan(options: ProjectOptions): ScaffoldPlan {
  return {
    options,
    targetDir: resolve(options.directory),
    files: generateProject(options),
    verificationUrl: getVerificationUrl(options.style),
  };
}

function getVerificationUrl(style: ProjectOptions['style']): string {
  return style === 'class-based' ? 'http://localhost:8080/api/health' : 'http://localhost:8080/health';
}
