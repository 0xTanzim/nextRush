import { defineConfig } from 'oxlint';

/**
 * Oxlint — the repository's lint gate (RFC-037).
 *
 * Replaced the ESLint flat config, which could not move to TypeScript 7:
 * `typescript-eslint` pins `peerDependencies.typescript: ">=4.8.4 <6.1.0"`, so the
 * typed-rule set and the TS 7 compiler could not coexist. Oxlint runs the same
 * type-aware rules through `oxlint-tsgolint` (built on `typescript-go`).
 *
 * Provenance: rule set translated mechanically from `eslint.config.mjs` with
 * `@oxlint/migrate --type-aware --details`, so severities and rule options are the
 * ones the previous config produced (`eslint --print-config` reported 135 enabled
 * rules; see `openspec/changes/adopt-ts7-oxlint-toolchain/evidence.md`).
 *
 * The rule list is INTENTIONALLY explicit and `categories.correctness` is off: the
 * effective rule set is pinned by this file, exactly as the ESLint preset lists were,
 * so a new Oxc release cannot silently start enforcing something new on this repo.
 */
export default defineConfig({
  plugins: ['typescript', 'unicorn'],

  // Type-aware rules run via the `oxlint-tsgolint` companion. This option is only
  // honoured in the ROOT config — nested configs must not set it.
  options: { typeAware: true },

  categories: { correctness: 'off' },

  env: { builtin: true },

  // The repo's own rule (ADR-R6): capability decisions must query RuntimeCapabilities,
  // never runtime identity. Loaded as a JS plugin in ESLint-plugin shape, so the rule ID
  // and every existing `eslint-disable` directive keep working unchanged.
  jsPlugins: [
    { name: 'nextrush', specifier: './tools/eslint-rules/no-runtime-identity-capability.mjs' },
  ],

  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/_archive/**',
    '**/.turbo/**',
  ],

  rules: {
    'constructor-super': 'error',
    'for-direction': 'error',
    'getter-return': 'error',
    'no-array-constructor': 'error',
    'no-async-promise-executor': 'error',
    'no-case-declarations': 'error',
    'no-class-assign': 'error',
    'no-compare-neg-zero': 'error',
    'no-cond-assign': 'error',
    'no-const-assign': 'error',
    'no-constant-binary-expression': 'error',
    'no-constant-condition': 'error',
    'no-control-regex': 'error',
    'no-debugger': 'error',
    'no-delete-var': 'error',
    'no-dupe-class-members': 'error',
    'no-dupe-else-if': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'no-empty': 'error',
    'no-empty-character-class': 'error',
    'no-empty-function': 'error',
    'no-empty-pattern': 'error',
    'no-empty-static-block': 'error',
    'no-ex-assign': 'error',
    'no-extra-boolean-cast': 'error',
    'no-fallthrough': 'error',
    'no-func-assign': 'error',
    'no-global-assign': 'error',
    'no-import-assign': 'error',
    'no-invalid-regexp': 'error',
    'no-irregular-whitespace': 'error',
    'no-loss-of-precision': 'error',
    'no-misleading-character-class': 'error',
    'no-new-native-nonconstructor': 'error',
    'no-nonoctal-decimal-escape': 'error',
    'no-obj-calls': 'error',
    'no-prototype-builtins': 'error',
    'no-redeclare': 'error',
    'no-regex-spaces': 'error',
    'no-self-assign': 'error',
    'no-setter-return': 'error',
    'no-shadow-restricted-names': 'error',
    'no-sparse-arrays': 'error',
    'no-this-before-super': 'error',
    'no-unreachable': 'error',
    'no-unsafe-finally': 'error',
    'no-unsafe-negation': 'error',
    'no-unsafe-optional-chaining': 'error',
    'no-unused-expressions': 'error',
    'no-unused-labels': 'error',
    'no-unused-private-class-members': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-useless-backreference': 'error',
    'no-useless-catch': 'error',
    'no-useless-constructor': 'error',
    'no-useless-escape': 'error',
    'no-with': 'error',
    'require-yield': 'error',
    'typescript/adjacent-overload-signatures': 'error',
    'typescript/array-type': 'error',
    'typescript/await-thenable': 'error',
    'typescript/ban-ts-comment': ['error', { minimumDescriptionLength: 10 }],
    'typescript/ban-tslint-comment': 'error',
    'typescript/class-literal-property-style': 'error',
    'typescript/consistent-generic-constructors': 'error',
    'typescript/consistent-indexed-object-style': 'error',
    'typescript/consistent-type-assertions': 'error',
    'typescript/consistent-type-definitions': 'error',
    'typescript/dot-notation': 'error',
    'typescript/no-array-delete': 'error',
    'typescript/no-base-to-string': 'error',
    'typescript/no-confusing-non-null-assertion': 'error',
    'typescript/no-confusing-void-expression': 'error',
    'typescript/no-deprecated': 'error',
    'typescript/no-duplicate-enum-values': 'error',
    'typescript/no-duplicate-type-constituents': 'error',
    'typescript/no-dynamic-delete': 'error',
    'typescript/no-empty-object-type': 'error',
    'typescript/no-explicit-any': 'error',
    'typescript/no-extra-non-null-assertion': 'error',
    'typescript/no-extraneous-class': 'error',
    'typescript/no-floating-promises': 'error',
    'typescript/no-for-in-array': 'error',
    'typescript/no-implied-eval': 'error',
    'typescript/no-inferrable-types': 'error',
    'typescript/no-invalid-void-type': 'error',
    'typescript/no-meaningless-void-operator': 'error',
    'typescript/no-misused-new': 'error',
    'typescript/no-misused-promises': 'error',
    'typescript/no-misused-spread': 'error',
    'typescript/no-mixed-enums': 'error',
    'typescript/no-namespace': 'error',
    'typescript/no-non-null-asserted-nullish-coalescing': 'error',
    'typescript/no-non-null-asserted-optional-chain': 'error',
    'typescript/no-non-null-assertion': 'warn',
    'typescript/no-redundant-type-constituents': 'error',
    'typescript/no-require-imports': 'error',
    'typescript/no-this-alias': 'error',
    'typescript/no-unnecessary-boolean-literal-compare': 'error',
    'typescript/no-unnecessary-condition': 'error',
    'typescript/no-unnecessary-template-expression': 'error',
    'typescript/no-unnecessary-type-arguments': 'error',
    'typescript/no-unnecessary-type-assertion': 'error',
    'typescript/no-unnecessary-type-constraint': 'error',
    'typescript/no-unnecessary-type-conversion': 'error',
    'typescript/no-unnecessary-type-parameters': 'error',
    'typescript/no-unsafe-argument': 'error',
    'typescript/no-unsafe-assignment': 'error',
    'typescript/no-unsafe-call': 'error',
    'typescript/no-unsafe-declaration-merging': 'error',
    'typescript/no-unsafe-enum-comparison': 'error',
    'typescript/no-unsafe-function-type': 'error',
    'typescript/no-unsafe-member-access': 'error',
    'typescript/no-unsafe-return': 'error',
    'typescript/no-unsafe-unary-minus': 'error',
    'typescript/no-useless-default-assignment': 'error',
    'typescript/no-wrapper-object-types': 'error',
    'typescript/non-nullable-type-assertion-style': 'error',
    'typescript/only-throw-error': 'error',
    'typescript/prefer-as-const': 'error',
    'typescript/prefer-find': 'error',
    'typescript/prefer-for-of': 'error',
    'typescript/prefer-function-type': 'error',
    'typescript/prefer-includes': 'error',
    'typescript/prefer-literal-enum-member': 'error',
    'typescript/prefer-namespace-keyword': 'error',
    'typescript/prefer-nullish-coalescing': 'error',
    'typescript/prefer-optional-chain': 'error',
    'typescript/prefer-promise-reject-errors': 'error',
    'typescript/prefer-reduce-type-parameter': 'error',
    'typescript/prefer-regexp-exec': 'error',
    'typescript/prefer-return-this-type': 'error',
    'typescript/prefer-string-starts-ends-with': 'error',
    'typescript/related-getter-setter-pairs': 'error',
    'typescript/require-await': 'warn',
    'typescript/restrict-plus-operands': ['error', { allowAny: false, allowBoolean: false, allowNullish: false, allowNumberAndString: false, allowRegExp: false }],
    'typescript/restrict-template-expressions': ['error', { allowAny: false, allowBoolean: false, allowNever: false, allowNullish: false, allowNumber: false, allowRegExp: false }],
    'typescript/return-await': ['error', 'error-handling-correctness-only'],
    'typescript/triple-slash-reference': 'error',
    'typescript/unbound-method': 'error',
    'typescript/unified-signatures': 'error',
    'typescript/use-unknown-in-catch-callback-variable': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
  },

  overrides: [
    {
      // typescript-eslint's `eslint-recommended` layer disables the JavaScript versions of
      // these rules for TypeScript files, because tsc already reports them. Oxlint supplies
      // type-aware implementations, so the JS versions stay off here for the same reason.
      files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
      rules: {
        'constructor-super': 'off',
        'getter-return': 'off',
        'no-class-assign': 'off',
        'no-const-assign': 'off',
        'no-dupe-class-members': 'off',
        'no-dupe-keys': 'off',
        'no-func-assign': 'off',
        'no-import-assign': 'off',
        'no-new-native-nonconstructor': 'off',
        'no-obj-calls': 'off',
        'no-redeclare': 'off',
        'no-setter-return': 'off',
        'no-this-before-super': 'off',
        'no-unreachable': 'off',
        'no-unsafe-negation': 'off',
        'no-var': 'error',
        'no-with': 'off',
        'prefer-const': 'error',
        'prefer-rest-params': 'error',
        'prefer-spread': 'error',
      },
    },

    {
      // Capability negotiation (ADR-R6): a capability decision must query
      // RuntimeCapabilities, not runtime identity — so an unknown-but-capable runtime
      // works with no code change. Genuine detection/optimization sites carry a
      // `// capability-exempt: <reason>` annotation, which the rule honours.
      //
      // Test files are excluded: tests may compare runtime names freely, and this mirrors
      // the previous config's `ignores` for this block.
      files: ['packages/**/src/**/*.ts'],
      excludeFiles: ['**/__tests__/**', '**/*.test.ts'],
      rules: {
        'nextrush/no-runtime-identity-capability': 'error',
      },
    },
  ],
});
