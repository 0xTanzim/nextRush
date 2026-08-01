/** Resolve the recorded version string for whichever benchmark tool is active. */

import { readAutocannonVersion } from './autocannon.js';
import { readWrkVersion } from './wrk.js';

export function getToolVersion(tool) {
  return tool === 'wrk' ? readWrkVersion() : readAutocannonVersion();
}
