import type { FileMap, ProjectOptions, Runtime } from '../types.js';

/**
 * Additive production-service preset (design decision 6).
 *
 * Emits a coherent quality/operational baseline on top of the lean starter:
 * editor settings, formatter/linter, CI validation, container files, ignore
 * entries, and production/health documentation. Every artifact references the
 * generated package.json scripts and the app's `/health` endpoint.
 */

const HEALTH_PATH = '/health';

function dockerBaseImage(runtime: Runtime): string {
  switch (runtime) {
    case 'bun':
      return 'oven/bun:1';
    case 'deno':
      return 'denoland/deno:alpine';
    case 'node':
      return 'node:22-alpine';
  }
}

function generateEditorConfig(): string {
  return `root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true
`;
}

function generateVscodeExtensions(): string {
  return `{
  "recommendations": ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"]
}
`;
}

function generateEslintConfig(): string {
  return `import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
`;
}

function generateCiWorkflow(): string {
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm install
      - run: npm run build
      - run: npm test
      - run: node dist/index.js & sleep 3 && curl -sf http://localhost:8080${HEALTH_PATH}
`;
}

function generateDockerfile(options: ProjectOptions): string {
  return `FROM ${dockerBaseImage(options.runtime)} AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM ${dockerBaseImage(options.runtime)} AS run
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["npm", "run", "start"]
`;
}

function generateDockerignore(): string {
  return `node_modules
dist
.env
.git
*.log
`;
}

function generateProdDocs(): string {
  return `# Production

This service exposes a ${HEALTH_PATH} endpoint for liveness/readiness probes and
health checks. Build with \`npm run build\` and start the production server with
\`npm run start\` (see package.json scripts).

Deployment-specific configuration lives in environment variables — see
\`src/env.ts\` for the full set. Container image: \`Dockerfile\` (multi-stage:
build then slim runtime image).
`;
}

/**
 * Returns the production-preset files. Empty when the preset is not selected,
 * so the base starter file map stays byte-for-byte unchanged.
 */
export function generatePresetFiles(options: ProjectOptions): FileMap {
  if (options.preset !== 'production') return new Map();

  const files: FileMap = new Map([
    ['.editorconfig', generateEditorConfig()],
    ['.vscode/extensions.json', generateVscodeExtensions()],
    ['eslint.config.mjs', generateEslintConfig()],
    ['.github/workflows/ci.yml', generateCiWorkflow()],
    ['Dockerfile', generateDockerfile(options)],
    ['.dockerignore', generateDockerignore()],
    ['docs/production.md', generateProdDocs()],
  ]);

  return files;
}
