# RFC-037 Rule Mapping — ESLint → Oxlint parity

Companion artifact to
[`037-typescript-7-oxlint-migration.md`](./037-typescript-7-oxlint-migration.md).
Task 1.5 of `openspec/changes/adopt-ts7-oxlint-toolchain`.

**Recorded 2026-09-28** on `oxlint@1.83.0` + `oxlint-tsgolint@7.0.2002`.

## Why this file exists

The migration replaces a rule set that was *enforced* (ESLint + typescript-eslint) with one that
must be *proved* equivalent before anything is removed. A silent downgrade here would be invisible:
lint still runs, still exits 0, and nobody notices that a rule stopped firing. So parity is a
counted, reproducible fact — every rule in the previous config appears exactly once below with an
explicit disposition.

## Method (mechanical, reproducible)

Both sides are read from the tools' own effective-config dumps, never from the config files by eye:

```bash
# previous side: ESLint's effective rules for a package source file
pnpm exec eslint --print-config packages/router/src/index.ts > /tmp/ts7/eslint-printconfig.json

# new side: Oxlint's effective rules (root config, incl. overrides)
pnpm exec oxlint --print-config > /tmp/ts7/oxlint-printconfig.json

# rule registry + type-aware classification
pnpm exec oxlint --rules
node -e "…@typescript-eslint/eslint-plugin… requiresTypeChecking…"

python3 /tmp/ts7/compare-rules.py /tmp/ts7/eslint-printconfig.json /tmp/ts7/oxlint-printconfig.json \
        packages/router/src/index.ts
python3 /tmp/ts7/gen-parity-map.py
```

Namespaces are normalized (`@typescript-eslint/x` ≡ `typescript/x`), and Oxlint overrides are applied
to the target path so a rule switched *off* inside an override is not counted as enabled.

## Headline

| Measure | Value |
| --- | --- |
| Rules enabled by the previous config | **135** |
| Disposition **equivalent** (same rule, same namespace) | **129** |
| Disposition **consolidated** (TS-namespace rule served by Oxlint's single implementation) | **5** |
| Disposition **not-implemented** (waived) | **1** (`no-octal`) |
| Available in Oxlint but *not* enabled in the config (would be a real gap) | **0** |
| Rules the new config enables that the old config did not | **0** |
| `@typescript-eslint` rules declaring `requiresTypeChecking` | **61** |
| …implemented by this `oxlint-tsgolint` build | **60 / 61** |

Two facts carry most of the weight:

1. **Zero new enforcement.** The migrated config does not enable anything the previous config did
   not — so no surprise findings, and the baseline (0 findings) is preserved by construction.
2. **Zero unenforced-but-available rules.** Nothing fell through to "we could have kept this and
   didn't" — every rule the old config turned on is either equivalent, consolidated, or waived below.

## Table A — the 61 type-aware rules (`requiresTypeChecking: true`)

This is the question "which type-aware rules have no tsgolint implementation?". Answer: **one** —
`naming-convention`.

Note this is **60/61**, one better than the upstream docs' headline "59 out of 61" — the count
moves between `oxlint-tsgolint` releases, and 7.0.2002 covers all but `naming-convention`.

`naming-convention` is a naming-style rule (patterns for variables, functions, classes, …). The
previous config did **not** enable it, so this is not a regression: nothing was enforced about
naming before, and nothing is enforced now. It is recorded here so the gap is a decision rather
than an accident.

```
- ✅ `await-thenable`
- ✅ `consistent-return`
- ✅ `consistent-type-exports`
- ✅ `dot-notation`
- ❌ **MISSING** `naming-convention`
- ✅ `no-array-delete`
- ✅ `no-base-to-string`
- ✅ `no-confusing-void-expression`
- ✅ `no-deprecated`
- ✅ `no-duplicate-type-constituents`
- ✅ `no-floating-promises`
- ✅ `no-for-in-array`
- ✅ `no-implied-eval`
- ✅ `no-meaningless-void-operator`
- ✅ `no-misused-promises`
- ✅ `no-misused-spread`
- ✅ `no-mixed-enums`
- ✅ `no-redundant-type-constituents`
- ✅ `no-unnecessary-boolean-literal-compare`
- ✅ `no-unnecessary-condition`
- ✅ `no-unnecessary-qualifier`
- ✅ `no-unnecessary-template-expression`
- ✅ `no-unnecessary-type-arguments`
- ✅ `no-unnecessary-type-assertion`
- ✅ `no-unnecessary-type-conversion`
- ✅ `no-unnecessary-type-parameters`
- ✅ `no-unsafe-argument`
- ✅ `no-unsafe-assignment`
- ✅ `no-unsafe-call`
- ✅ `no-unsafe-enum-comparison`
- ✅ `no-unsafe-member-access`
- ✅ `no-unsafe-return`
- ✅ `no-unsafe-type-assertion`
- ✅ `no-unsafe-unary-minus`
- ✅ `no-useless-default-assignment`
- ✅ `non-nullable-type-assertion-style`
- ✅ `only-throw-error`
- ✅ `prefer-destructuring`
- ✅ `prefer-find`
- ✅ `prefer-includes`
- ✅ `prefer-nullish-coalescing`
- ✅ `prefer-optional-chain`
- ✅ `prefer-promise-reject-errors`
- ✅ `prefer-readonly`
- ✅ `prefer-readonly-parameter-types`
- ✅ `prefer-reduce-type-parameter`
- ✅ `prefer-regexp-exec`
- ✅ `prefer-return-this-type`
- ✅ `prefer-string-starts-ends-with`
- ✅ `promise-function-async`
- ✅ `related-getter-setter-pairs`
- ✅ `require-array-sort-compare`
- ✅ `require-await`
- ✅ `restrict-plus-operands`
- ✅ `restrict-template-expressions`
- ✅ `return-await`
- ✅ `strict-boolean-expressions`
- ✅ `strict-void-return`
- ✅ `switch-exhaustiveness-check`
- ✅ `unbound-method`
- ✅ `use-unknown-in-catch-callback-variable`
```

## Table B — every rule the previous config enabled (135 rows)

### Disposition key

| Disposition | Meaning |
| --- | --- |
| `equivalent` | Same rule, matched in Oxlint's config after namespace normalization. |
| `consolidated` | `@typescript-eslint/x` has no `typescript/x` twin in Oxlint; Oxlint implements `x` once in the `eslint` namespace (with TypeScript support) and that implementation is enabled. Behaviour is still enforced. |
| `not-implemented` | No equivalent exists in Oxlint. Waived, with rationale below. |

### The 5 consolidated rules

Oxlint serves these with a **single** implementation named in the `eslint` namespace rather than a
separate `typescript/*` variant. The previous config enforced them as `@typescript-eslint/x` while
switching the plain `x` off for TypeScript files; Oxlint keeps one TypeScript-aware rule instead —
the behaviour under test is the same, only the name differs.

- `@typescript-eslint/no-array-constructor` → `no-array-constructor`
- `@typescript-eslint/no-empty-function` → `no-empty-function`
- `@typescript-eslint/no-unused-expressions` → `no-unused-expressions`
- `@typescript-eslint/no-unused-vars` → `no-unused-vars` (options preserved: `argsIgnorePattern: ^_`, `varsIgnorePattern: ^_`)
- `@typescript-eslint/no-useless-constructor` → `no-useless-constructor`

### The 1 waiver: `no-octal`

| Previous rule | Status | Rationale |
| --- | --- | --- |
| `no-octal` | **not implemented in Oxlint** | Oxlint reports it as *"Superseded by strict mode."* (`@oxlint/migrate --details`). The rule exists to catch legacy octal literals like `0644`, which are a **syntax error in strict mode** — and this repository is ESM-only, so every module is always strict. ES modules also cannot have an indirect `octalPrefix` at all. Waived as unreachable here; `tsc` and the ESM parser still reject the construct. |

No other rule from the previous config is dropped.

### Full listing

| Previous rule (ESLint) | Oxlint equivalent | Disposition |
| --- | --- | --- |
| `@typescript-eslint/adjacent-overload-signatures` | `typescript/adjacent-overload-signatures` | equivalent |
| `@typescript-eslint/array-type` | `typescript/array-type` | equivalent |
| `@typescript-eslint/await-thenable` | `typescript/await-thenable` | equivalent |
| `@typescript-eslint/ban-ts-comment` | `typescript/ban-ts-comment` | equivalent |
| `@typescript-eslint/ban-tslint-comment` | `typescript/ban-tslint-comment` | equivalent |
| `@typescript-eslint/class-literal-property-style` | `typescript/class-literal-property-style` | equivalent |
| `@typescript-eslint/consistent-generic-constructors` | `typescript/consistent-generic-constructors` | equivalent |
| `@typescript-eslint/consistent-indexed-object-style` | `typescript/consistent-indexed-object-style` | equivalent |
| `@typescript-eslint/consistent-type-assertions` | `typescript/consistent-type-assertions` | equivalent |
| `@typescript-eslint/consistent-type-definitions` | `typescript/consistent-type-definitions` | equivalent |
| `@typescript-eslint/dot-notation` | `typescript/dot-notation` | equivalent |
| `@typescript-eslint/no-array-constructor` | `no-array-constructor` | consolidated |
| `@typescript-eslint/no-array-delete` | `typescript/no-array-delete` | equivalent |
| `@typescript-eslint/no-base-to-string` | `typescript/no-base-to-string` | equivalent |
| `@typescript-eslint/no-confusing-non-null-assertion` | `typescript/no-confusing-non-null-assertion` | equivalent |
| `@typescript-eslint/no-confusing-void-expression` | `typescript/no-confusing-void-expression` | equivalent |
| `@typescript-eslint/no-deprecated` | `typescript/no-deprecated` | equivalent |
| `@typescript-eslint/no-duplicate-enum-values` | `typescript/no-duplicate-enum-values` | equivalent |
| `@typescript-eslint/no-duplicate-type-constituents` | `typescript/no-duplicate-type-constituents` | equivalent |
| `@typescript-eslint/no-dynamic-delete` | `typescript/no-dynamic-delete` | equivalent |
| `@typescript-eslint/no-empty-function` | `no-empty-function` | consolidated |
| `@typescript-eslint/no-empty-object-type` | `typescript/no-empty-object-type` | equivalent |
| `@typescript-eslint/no-explicit-any` | `typescript/no-explicit-any` | equivalent |
| `@typescript-eslint/no-extra-non-null-assertion` | `typescript/no-extra-non-null-assertion` | equivalent |
| `@typescript-eslint/no-extraneous-class` | `typescript/no-extraneous-class` | equivalent |
| `@typescript-eslint/no-floating-promises` | `typescript/no-floating-promises` | equivalent |
| `@typescript-eslint/no-for-in-array` | `typescript/no-for-in-array` | equivalent |
| `@typescript-eslint/no-implied-eval` | `typescript/no-implied-eval` | equivalent |
| `@typescript-eslint/no-inferrable-types` | `typescript/no-inferrable-types` | equivalent |
| `@typescript-eslint/no-invalid-void-type` | `typescript/no-invalid-void-type` | equivalent |
| `@typescript-eslint/no-meaningless-void-operator` | `typescript/no-meaningless-void-operator` | equivalent |
| `@typescript-eslint/no-misused-new` | `typescript/no-misused-new` | equivalent |
| `@typescript-eslint/no-misused-promises` | `typescript/no-misused-promises` | equivalent |
| `@typescript-eslint/no-misused-spread` | `typescript/no-misused-spread` | equivalent |
| `@typescript-eslint/no-mixed-enums` | `typescript/no-mixed-enums` | equivalent |
| `@typescript-eslint/no-namespace` | `typescript/no-namespace` | equivalent |
| `@typescript-eslint/no-non-null-asserted-nullish-coalescing` | `typescript/no-non-null-asserted-nullish-coalescing` | equivalent |
| `@typescript-eslint/no-non-null-asserted-optional-chain` | `typescript/no-non-null-asserted-optional-chain` | equivalent |
| `@typescript-eslint/no-non-null-assertion` | `typescript/no-non-null-assertion` | equivalent |
| `@typescript-eslint/no-redundant-type-constituents` | `typescript/no-redundant-type-constituents` | equivalent |
| `@typescript-eslint/no-require-imports` | `typescript/no-require-imports` | equivalent |
| `@typescript-eslint/no-this-alias` | `typescript/no-this-alias` | equivalent |
| `@typescript-eslint/no-unnecessary-boolean-literal-compare` | `typescript/no-unnecessary-boolean-literal-compare` | equivalent |
| `@typescript-eslint/no-unnecessary-condition` | `typescript/no-unnecessary-condition` | equivalent |
| `@typescript-eslint/no-unnecessary-template-expression` | `typescript/no-unnecessary-template-expression` | equivalent |
| `@typescript-eslint/no-unnecessary-type-arguments` | `typescript/no-unnecessary-type-arguments` | equivalent |
| `@typescript-eslint/no-unnecessary-type-assertion` | `typescript/no-unnecessary-type-assertion` | equivalent |
| `@typescript-eslint/no-unnecessary-type-constraint` | `typescript/no-unnecessary-type-constraint` | equivalent |
| `@typescript-eslint/no-unnecessary-type-conversion` | `typescript/no-unnecessary-type-conversion` | equivalent |
| `@typescript-eslint/no-unnecessary-type-parameters` | `typescript/no-unnecessary-type-parameters` | equivalent |
| `@typescript-eslint/no-unsafe-argument` | `typescript/no-unsafe-argument` | equivalent |
| `@typescript-eslint/no-unsafe-assignment` | `typescript/no-unsafe-assignment` | equivalent |
| `@typescript-eslint/no-unsafe-call` | `typescript/no-unsafe-call` | equivalent |
| `@typescript-eslint/no-unsafe-declaration-merging` | `typescript/no-unsafe-declaration-merging` | equivalent |
| `@typescript-eslint/no-unsafe-enum-comparison` | `typescript/no-unsafe-enum-comparison` | equivalent |
| `@typescript-eslint/no-unsafe-function-type` | `typescript/no-unsafe-function-type` | equivalent |
| `@typescript-eslint/no-unsafe-member-access` | `typescript/no-unsafe-member-access` | equivalent |
| `@typescript-eslint/no-unsafe-return` | `typescript/no-unsafe-return` | equivalent |
| `@typescript-eslint/no-unsafe-unary-minus` | `typescript/no-unsafe-unary-minus` | equivalent |
| `@typescript-eslint/no-unused-expressions` | `no-unused-expressions` | consolidated |
| `@typescript-eslint/no-unused-vars` | `no-unused-vars` | consolidated |
| `@typescript-eslint/no-useless-constructor` | `no-useless-constructor` | consolidated |
| `@typescript-eslint/no-useless-default-assignment` | `typescript/no-useless-default-assignment` | equivalent |
| `@typescript-eslint/no-wrapper-object-types` | `typescript/no-wrapper-object-types` | equivalent |
| `@typescript-eslint/non-nullable-type-assertion-style` | `typescript/non-nullable-type-assertion-style` | equivalent |
| `@typescript-eslint/only-throw-error` | `typescript/only-throw-error` | equivalent |
| `@typescript-eslint/prefer-as-const` | `typescript/prefer-as-const` | equivalent |
| `@typescript-eslint/prefer-find` | `typescript/prefer-find` | equivalent |
| `@typescript-eslint/prefer-for-of` | `typescript/prefer-for-of` | equivalent |
| `@typescript-eslint/prefer-function-type` | `typescript/prefer-function-type` | equivalent |
| `@typescript-eslint/prefer-includes` | `typescript/prefer-includes` | equivalent |
| `@typescript-eslint/prefer-literal-enum-member` | `typescript/prefer-literal-enum-member` | equivalent |
| `@typescript-eslint/prefer-namespace-keyword` | `typescript/prefer-namespace-keyword` | equivalent |
| `@typescript-eslint/prefer-nullish-coalescing` | `typescript/prefer-nullish-coalescing` | equivalent |
| `@typescript-eslint/prefer-optional-chain` | `typescript/prefer-optional-chain` | equivalent |
| `@typescript-eslint/prefer-promise-reject-errors` | `typescript/prefer-promise-reject-errors` | equivalent |
| `@typescript-eslint/prefer-reduce-type-parameter` | `typescript/prefer-reduce-type-parameter` | equivalent |
| `@typescript-eslint/prefer-regexp-exec` | `typescript/prefer-regexp-exec` | equivalent |
| `@typescript-eslint/prefer-return-this-type` | `typescript/prefer-return-this-type` | equivalent |
| `@typescript-eslint/prefer-string-starts-ends-with` | `typescript/prefer-string-starts-ends-with` | equivalent |
| `@typescript-eslint/related-getter-setter-pairs` | `typescript/related-getter-setter-pairs` | equivalent |
| `@typescript-eslint/require-await` | `typescript/require-await` | equivalent |
| `@typescript-eslint/restrict-plus-operands` | `typescript/restrict-plus-operands` | equivalent |
| `@typescript-eslint/restrict-template-expressions` | `typescript/restrict-template-expressions` | equivalent |
| `@typescript-eslint/return-await` | `typescript/return-await` | equivalent |
| `@typescript-eslint/triple-slash-reference` | `typescript/triple-slash-reference` | equivalent |
| `@typescript-eslint/unbound-method` | `typescript/unbound-method` | equivalent |
| `@typescript-eslint/unified-signatures` | `typescript/unified-signatures` | equivalent |
| `@typescript-eslint/use-unknown-in-catch-callback-variable` | `typescript/use-unknown-in-catch-callback-variable` | equivalent |
| `for-direction` | `for-direction` | equivalent |
| `nextrush/no-runtime-identity-capability` | `nextrush/no-runtime-identity-capability` | equivalent |
| `no-async-promise-executor` | `no-async-promise-executor` | equivalent |
| `no-case-declarations` | `no-case-declarations` | equivalent |
| `no-compare-neg-zero` | `no-compare-neg-zero` | equivalent |
| `no-cond-assign` | `no-cond-assign` | equivalent |
| `no-constant-binary-expression` | `no-constant-binary-expression` | equivalent |
| `no-constant-condition` | `no-constant-condition` | equivalent |
| `no-control-regex` | `no-control-regex` | equivalent |
| `no-debugger` | `no-debugger` | equivalent |
| `no-delete-var` | `no-delete-var` | equivalent |
| `no-dupe-else-if` | `no-dupe-else-if` | equivalent |
| `no-duplicate-case` | `no-duplicate-case` | equivalent |
| `no-empty` | `no-empty` | equivalent |
| `no-empty-character-class` | `no-empty-character-class` | equivalent |
| `no-empty-pattern` | `no-empty-pattern` | equivalent |
| `no-empty-static-block` | `no-empty-static-block` | equivalent |
| `no-ex-assign` | `no-ex-assign` | equivalent |
| `no-extra-boolean-cast` | `no-extra-boolean-cast` | equivalent |
| `no-fallthrough` | `no-fallthrough` | equivalent |
| `no-global-assign` | `no-global-assign` | equivalent |
| `no-invalid-regexp` | `no-invalid-regexp` | equivalent |
| `no-irregular-whitespace` | `no-irregular-whitespace` | equivalent |
| `no-loss-of-precision` | `no-loss-of-precision` | equivalent |
| `no-misleading-character-class` | `no-misleading-character-class` | equivalent |
| `no-nonoctal-decimal-escape` | `no-nonoctal-decimal-escape` | equivalent |
| `no-octal` | — | not-implemented |
| `no-prototype-builtins` | `no-prototype-builtins` | equivalent |
| `no-regex-spaces` | `no-regex-spaces` | equivalent |
| `no-self-assign` | `no-self-assign` | equivalent |
| `no-shadow-restricted-names` | `no-shadow-restricted-names` | equivalent |
| `no-sparse-arrays` | `no-sparse-arrays` | equivalent |
| `no-unsafe-finally` | `no-unsafe-finally` | equivalent |
| `no-unsafe-optional-chaining` | `no-unsafe-optional-chaining` | equivalent |
| `no-unused-labels` | `no-unused-labels` | equivalent |
| `no-unused-private-class-members` | `no-unused-private-class-members` | equivalent |
| `no-useless-backreference` | `no-useless-backreference` | equivalent |
| `no-useless-catch` | `no-useless-catch` | equivalent |
| `no-useless-escape` | `no-useless-escape` | equivalent |
| `no-var` | `no-var` | equivalent |
| `prefer-const` | `prefer-const` | equivalent |
| `prefer-rest-params` | `prefer-rest-params` | equivalent |
| `prefer-spread` | `prefer-spread` | equivalent |
| `require-yield` | `require-yield` | equivalent |
| `use-isnan` | `use-isnan` | equivalent |
| `valid-typeof` | `valid-typeof` | equivalent |

## Non-rule deltas carried by the config translation

Rules are only part of the migration. These structural differences were found and handled
explicitly, so they are recorded rather than left implicit:

| Previous ESLint config | Oxlint config | Note |
| --- | --- | --- |
| `parserOptions.projectService: true` + `tsconfigRootDir` | `options.typeAware: true` | Type-aware mode is honoured **only in the root config**; nested configs must not set it. Oxlint discovers each file's `tsconfig.json` itself. |
| `ignores: ['**/__tests__/**', '**/*.test.ts']` inside the custom-rule block | `excludeFiles: [...]` on the same override | The migrator emitted a warning — *"ignore list inside overrides is not supported"* — and dropped the list. Re-added with the schema's `excludeFiles`, so tests are still exempt from the repo rule. |
| `plugins: { nextrush: { rules: … } }` imported from `./tools/eslint-rules/no-runtime-identity-capability.mjs` | `jsPlugins: [{ name: 'nextrush', specifier: './tools/eslint-rules/no-runtime-identity-capability.mjs' }]` | The migrator guessed `eslint-plugin-nextrush`, which **does not exist** in this repo. Corrected to the real local file, aliased so the rule ID `nextrush/no-runtime-identity-capability` — and every in-source directive naming it — is unchanged. |
| Root `eslint.config.mjs` (ESM, `.mjs`) | `oxlint.config.ts` | Loading a `.ts` config makes Node emit `MODULE_TYPELESS_PACKAGE_JSON` on **stderr on every run**. Fixed by adding `"type": "module"` to the root `package.json`, which is what the warning recommends and what the repo's ESM-only identity already implies (verified: no CommonJS files are scoped to the root manifest, and root-scoped `tsx` scripts still pass). |
| `eslint-config-prettier` layer | not needed | Oxlint does not conflict with Prettier's formatting rules; the formatter stays Prettier. |

## Verification commands for this file

```bash
# 1. no rule from the old config is missing (expect: only no-octal)
python3 /tmp/ts7/compare-rules.py /tmp/ts7/eslint-printconfig.json /tmp/ts7/oxlint-printconfig.json \
        packages/router/src/index.ts
#    → "ESLint behaviours with no oxlint equivalent at any namespace (1): no-octal"

# 2. every rule in the repo's oxlint config is actually registered
pnpm exec oxlint --print-config | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['rules']))"
```
