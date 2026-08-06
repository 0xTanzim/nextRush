import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { toPackageName } from './utils.js';

/**
 * Workspace destination policy (design decision 6).
 *
 * The smallest documented supported layout: a pnpm workspace with an `apps/*`
 * packages glob. When a workspace is detected, the scaffolder reports the resolved
 * `apps/<name>` destination, the package name, and the policy. Unsupported layouts
 * fail with actionable guidance rather than guessing.
 */

export interface WorkspaceOk {
  readonly ok: true;
  readonly destination: string;
  readonly packageName: string;
  readonly policy: string;
}

export interface WorkspaceFailure {
  readonly ok: false;
  readonly guidance: string;
}

export type WorkspaceResolution = WorkspaceOk | WorkspaceFailure;

/** True when the directory is a pnpm workspace whose packages glob includes `apps/*`. */
export function isSupportedWorkspace(cwd: string): boolean {
  const manifest = join(cwd, 'pnpm-workspace.yaml');
  if (!existsSync(manifest)) return false;

  try {
    const content = readFileSync(manifest, 'utf-8');
    return content.includes('apps/*');
  } catch {
    return false;
  }
}

/**
 * Resolves the workspace destination for a project name, or returns actionable
 * guidance when the workspace is unsupported.
 */
export function resolveWorkspaceDestination(name: string, cwd: string): WorkspaceResolution {
  if (!isSupportedWorkspace(cwd)) {
    return {
      ok: false,
      guidance:
        'No supported workspace detected. create-nextrush workspace mode requires a pnpm ' +
        'workspace with an `apps/*` packages glob (pnpm-workspace.yaml). Run in the workspace ' +
        'root, or scaffold a standalone project without --workspace.',
    };
  }

  const packageName = toPackageName(name);
  return {
    ok: true,
    destination: join(cwd, 'apps', packageName),
    packageName,
    policy: 'pnpm workspace (apps/*)',
  };
}
