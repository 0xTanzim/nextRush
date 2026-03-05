/**
 * @nextrush/dev - Runtime Module Exports
 *
 * Re-exports all runtime detection and cross-runtime utilities.
 *
 * @packageDocumentation
 */

export {
  detectRuntime,
  exitProcess,
  getEnv,
  getRuntimeExecutable,
  getRuntimeInfo,
  isBun,
  isDeno,
  isNode,
  onSignal,
  type Runtime,
  type RuntimeInfo,
} from './detect.js';

export { buildDevArgs, spawn, type SpawnOptions, type SpawnResult } from './spawn.js';

export {
  exists,
  existsSync,
  getCwd,
  initFsSync,
  joinPath,
  mkdir,
  readFile,
  readFileSync,
  resolvePath,
  writeFile,
} from './fs.js';

// Node.js module constants for Deno compatibility
export {
  NODE_CHILD_PROCESS,
  NODE_FS,
  NODE_FS_PROMISES,
  NODE_MODULE,
  NODE_OS,
  NODE_PATH,
  NODE_PROCESS,
  NODE_URL,
  NODE_UTIL,
  getSwcNodeRegisterPath,
} from './node-modules.js';
