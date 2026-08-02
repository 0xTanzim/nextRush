#!/usr/bin/env node
import { cli } from '../dist/cli.js';

// `cli()` resolves once the routed command's work completed (issue #40); surface
// an unexpected rejection with a non-zero exit instead of exiting 0 silently.
cli().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
