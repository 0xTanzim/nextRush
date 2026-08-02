---
"create-nextrush": patch
---

Scaffolded projects now pin `compilerOptions.types: ["node"]` in the generated
tsconfig.json. TypeScript >= 6 no longer auto-includes `@types/*` when `types` is
omitted, so a generated project failed `tsc --noEmit` with TS2591 ("Cannot find
name 'process'") out of the box even though `@types/node` is installed as a
devDependency (issue #40). The explicit pin restores the type-checking a scaffolded
app expects, matching the `@types/node` devDependency the scaffolder always installs.
