/**
 * Global version store — set once at CLI startup.
 * Templates read from here instead of build-time constants.
 */

let coreRange = '^0.0.0';
let mwRange = '^0.0.0';

export function setVersions(core: string, mw: string): void {
  coreRange = core;
  mwRange = mw;
}

export function getCoreRange(): string {
  return coreRange;
}

export function getMwRange(): string {
  return mwRange;
}
