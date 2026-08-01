/** Filesystem helpers for writing benchmark output. */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export function saveResults(dir, filename, data) {
  ensureDir(dir);
  writeFileSync(join(dir, filename), JSON.stringify(data, null, 2), 'utf-8');
}

export function saveReport(dir, filename, content) {
  ensureDir(dir);
  writeFileSync(join(dir, filename), content, 'utf-8');
}
