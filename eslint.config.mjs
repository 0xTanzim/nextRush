import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import { noRuntimeIdentityCapability } from './tools/eslint-rules/no-runtime-identity-capability.js';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'warn',
    },
  },
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/_archive/**',
      '**/.turbo/**',
    ],
  },
  {
    // Capability negotiation (RFC/ADR-R6): capability decisions must query
    // RuntimeCapabilities, not runtime identity. Enforced first in the runtime
    // package (the authoritative capability source); repo-wide rollout tracked
    // as a follow-up (openspec harden-runtime-edge-serverless task 2.3a) so the
    // ~34 legitimate detection/optimization sites elsewhere can be annotated in
    // a dedicated sweep rather than breaking lint everywhere at once.
    files: ['packages/runtime/src/**/*.ts'],
    ignores: ['**/__tests__/**', '**/*.test.ts'],
    plugins: { nextrush: { rules: { 'no-runtime-identity-capability': noRuntimeIdentityCapability } } },
    rules: { 'nextrush/no-runtime-identity-capability': 'error' },
  }
);
