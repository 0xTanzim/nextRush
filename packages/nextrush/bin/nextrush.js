#!/usr/bin/env node
/**
 * `nextrush` meta-package launcher (ADR-0013).
 *
 * Delegates to the optional `@nextrush/dev` toolkit when installed, or prints an actionable
 * install message when it is absent. All logic lives in `dev-cli-launcher.ts`; this file is only
 * the executable entry point and never runs at install time (only on explicit `nextrush <command>`).
 */
import { runDevCliLauncher } from '../dist/dev-cli-launcher.js';

runDevCliLauncher(process.argv.slice(2))
  .then((code) => {
    process.exit(code);
  })
  .catch((err) => {
    // Unrelated error surfaced unchanged (not the missing-toolkit case).
    console.error(err);
    process.exit(1);
  });
