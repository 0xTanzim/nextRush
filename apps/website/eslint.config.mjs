import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.source/**',
    // Build/deploy artifacts (e.g. the compiled Cloudflare Worker) -- generated
    // output, not source; linting it only produces noise.
    'public/**',
  ]),
]);

export default eslintConfig;