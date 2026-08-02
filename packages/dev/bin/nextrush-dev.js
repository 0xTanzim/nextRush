#!/usr/bin/env node
import { legacyDevCli } from '../dist/cli.js';

// `legacyDevCli` resolves once the dev server exited (issue #40); surface an
// unexpected rejection with a non-zero exit instead of exiting 0 silently.
legacyDevCli(process.argv.slice(2)).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
