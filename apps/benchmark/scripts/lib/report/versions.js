/**
 * Which version of each framework was actually measured.
 *
 * Pure: callers supply the installed `devDependencies`, the Node version, and the
 * workspace version, so this never guesses from the filesystem. A framework whose
 * package is absent is omitted rather than reported as an unknown version — the
 * report then says "not recorded" instead of implying a value it does not have.
 */

/** Benchmark server id → the npm package whose version defines it. */
const PACKAGE_BY_FRAMEWORK = {
  fastify: 'fastify',
  hono: 'hono',
  koa: 'koa',
  express: 'express',
};

/** Servers built on this repo rather than a published dependency. */
const WORKSPACE_FRAMEWORKS = ['nextrush-v3', 'nextrush-v3-class'];

export function resolveFrameworkVersions({
  devDependencies = {},
  nodeVersion = null,
  nextrushVersion = null,
} = {}) {
  const versions = {};

  for (const [frameworkId, packageName] of Object.entries(PACKAGE_BY_FRAMEWORK)) {
    const version = devDependencies[packageName];
    if (version) versions[frameworkId] = String(version).replace(/^[\^~]/, '');
  }

  if (nodeVersion) versions['raw-node'] = `Node ${nodeVersion}`;
  if (nextrushVersion) {
    for (const frameworkId of WORKSPACE_FRAMEWORKS) {
      versions[frameworkId] = `${nextrushVersion} (workspace)`;
    }
  }

  return versions;
}
