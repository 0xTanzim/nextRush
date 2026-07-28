/**
 * Read which framework versions are installed right now.
 *
 * Split from the pure `report/versions.js` so the resolution logic stays
 * unit-testable and callers stay explicit about provenance: a run records this at
 * measurement time, while report regeneration reads it later and must label it as
 * such — the two are not the same claim.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { ROOT_DIR } from './paths.js';
import { resolveFrameworkVersions } from './report/versions.js';

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

export function readInstalledFrameworkVersions() {
  const benchmarkPackage = readJson(join(ROOT_DIR, 'package.json')) || {};
  const corePackage = readJson(resolve(ROOT_DIR, '..', '..', 'packages', 'core', 'package.json'));

  return resolveFrameworkVersions({
    devDependencies: benchmarkPackage.devDependencies || {},
    nodeVersion: process.version,
    nextrushVersion: corePackage?.version || null,
  });
}
